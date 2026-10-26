"""Minimal pure-Python .blend reader (64-bit little-endian, uncompressed)."""
import struct, re, numpy as np

class Blend:
    def __init__(self, path):
        self.f = open(path, 'rb')
        self.data = self.f.read()
        h = self.data[:12]
        assert h[:7] == b'BLENDER' and h[7:8] == b'-' and h[8:9] == b'v', h
        self.version = int(h[9:12])
        self.blocks = []
        self.by_ptr = {}
        off = 12
        d = self.data
        self._idx = {}
        while True:
            code, ln, ptr, sdna, nr = struct.unpack_from('<4siQii', d, off)
            off += 24
            b = (code, ln, ptr, sdna, nr, off)
            if code == b'ENDB':
                break
            self._idx[ptr, off] = len(self.blocks)
            self.blocks.append(b)
            if ptr:
                self.by_ptr.setdefault(ptr, []).append(len(self.blocks) - 1)
            if code == b'DNA1':
                self._parse_sdna(off, ln)
            off += ln

    def _parse_sdna(self, off, ln):
        d = self.data
        p = off
        assert d[p:p+4] == b'SDNA'; p += 4
        assert d[p:p+4] == b'NAME'; p += 4
        n, = struct.unpack_from('<i', d, p); p += 4
        names = []
        for _ in range(n):
            e = d.index(b'\0', p); names.append(d[p:e].decode('latin1')); p = e + 1
        p = off + ((p - off + 3) & ~3)
        assert d[p:p+4] == b'TYPE'; p += 4
        n, = struct.unpack_from('<i', d, p); p += 4
        types = []
        for _ in range(n):
            e = d.index(b'\0', p); types.append(d[p:e].decode('latin1')); p = e + 1
        p = off + ((p - off + 3) & ~3)
        assert d[p:p+4] == b'TLEN'; p += 4
        tlen = list(struct.unpack_from('<%dh' % len(types), d, p)); p += 2 * len(types)
        p = off + ((p - off + 3) & ~3)
        assert d[p:p+4] == b'STRC'; p += 4
        n, = struct.unpack_from('<i', d, p); p += 4
        self.names, self.types, self.tlen = names, types, tlen
        self.structs = []  # list of (typename, fields{name:(type, off, size, ptr, dims)})
        self.struct_by_type = {}
        for si in range(n):
            t, nf = struct.unpack_from('<hh', d, p); p += 4
            fields = {}
            o = 0
            for _ in range(nf):
                ft, fn = struct.unpack_from('<hh', d, p); p += 4
                name = names[fn]
                isptr = name.startswith('*') or name.startswith('(*')
                dims = [int(x) for x in re.findall(r'\[(\d+)\]', name)]
                cnt = 1
                for x in dims: cnt *= x
                size = (8 if isptr else tlen[ft]) * cnt
                clean = re.sub(r'\[.*', '', name).lstrip('*').replace('(', '').replace(')', '')
                fields[clean] = (types[ft], o, size, isptr, dims, name)
                o += size
            self.structs.append((types[t], fields))
            self.struct_by_type[types[t]] = si

    def fields(self, typename):
        return self.structs[self.struct_by_type[typename]][1]

    def get(self, typename, base, field):
        ft, o, size, isptr, dims, raw = self.fields(typename)[field]
        p = base + o
        d = self.data
        if isptr:
            if dims:
                return list(struct.unpack_from('<%dQ' % (size // 8), d, p))
            return struct.unpack_from('<Q', d, p)[0]
        if ft == 'char':
            if dims:
                s = d[p:p+size]; return s.split(b'\0')[0].decode('utf-8', 'replace')
            return d[p]
        fmt = {'int': 'i', 'short': 'h', 'float': 'f', 'double': 'd', 'uint64_t': 'Q', 'int64_t': 'q', 'uint': 'I', 'ushort': 'H', 'uchar': 'B', 'int8_t': 'b'}.get(ft)
        if fmt:
            n = size // struct.calcsize(fmt)
            v = struct.unpack_from('<%d%s' % (n, fmt), d, p)
            return v if dims else v[0]
        return p  # nested struct: return absolute offset

    def block(self, ptr, near=None):
        l = self.by_ptr.get(ptr)
        if not l: return None
        if len(l) == 1 or near is None: return self.blocks[l[0]]
        after = [i for i in l if i >= near]
        i = min(after) if after else min(l, key=lambda i: abs(i - near))
        return self.blocks[i]
    def index_of(self, b):
        return self._idx[b[2], b[5]]

    def blocks_of(self, code):
        return [b for b in self.blocks if b[0] == code]

    def sdna_name(self, b):
        return self.structs[b[3]][0]
