#include "CorpusDatos.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogCorpus, Log, All);

namespace
{
	struct FDefCapa { const TCHAR* Clave; const TCHAR* Nombre; const TCHAR* Color; bool bOn; float Op; const TCHAR* Grupo; const TCHAR* Sexo; const TCHAR* Base; };
	// Misma tabla que SYS en index.html (orden, nombres, colores, capas encendidas al inicio y opacidad).
	const FDefCapa DEF_CAPAS[] = {
		{TEXT("oseo"), TEXT("Huesos, cartílagos y dientes"), TEXT("ece2cb"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("muscular"), TEXT("Músculos"), TEXT("a3392f"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("insercion"), TEXT("Orígenes e inserciones"), TEXT("2f9e5b"), false, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("articular"), TEXT("Ligamentos, cápsulas y discos"), TEXT("d3dde6"), false, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("fascia"), TEXT("Fascias y retináculos"), TEXT("cdb594"), false, .7f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("bolsas"), TEXT("Bolsas sinoviales y vainas"), TEXT("8fb7c9"), false, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("arterial"), TEXT("Arterias y corazón"), TEXT("c53a2f"), false, 1.f, TEXT("Circulación"), TEXT(""), TEXT("")},
		{TEXT("venoso"), TEXT("Venas"), TEXT("3f62ad"), false, 1.f, TEXT("Circulación"), TEXT(""), TEXT("")},
		{TEXT("linfatico"), TEXT("Ganglios y órganos linfáticos"), TEXT("6aa874"), false, 1.f, TEXT("Circulación"), TEXT(""), TEXT("")},
		{TEXT("nervioso_central"), TEXT("Encéfalo y médula espinal"), TEXT("e6c4b0"), false, 1.f, TEXT("Sistema nervioso"), TEXT(""), TEXT("")},
		{TEXT("nervioso_periferico"), TEXT("Nervios periféricos"), TEXT("e3c23f"), false, 1.f, TEXT("Sistema nervioso"), TEXT(""), TEXT("")},
		{TEXT("respiratorio"), TEXT("Respiratorio"), TEXT("d99b9b"), false, 1.f, TEXT("Vísceras"), TEXT(""), TEXT("")},
		{TEXT("digestivo"), TEXT("Digestivo"), TEXT("c98b67"), false, 1.f, TEXT("Vísceras"), TEXT(""), TEXT("")},
		{TEXT("urinario"), TEXT("Urinario"), TEXT("a65d4c"), false, 1.f, TEXT("Vísceras"), TEXT(""), TEXT("")},
		{TEXT("reproductor"), TEXT("Reproductor"), TEXT("c48aa0"), false, 1.f, TEXT("Vísceras"), TEXT("m"), TEXT("")},
		{TEXT("reproductor_f"), TEXT("Reproductor femenino"), TEXT("c78a85"), false, 1.f, TEXT("Vísceras"), TEXT("f"), TEXT("reproductor")},
		{TEXT("endocrino"), TEXT("Endocrino"), TEXT("9a6bc2"), false, 1.f, TEXT("Vísceras"), TEXT(""), TEXT("")},
		{TEXT("mama"), TEXT("Mama y glándula mamaria"), TEXT("e9c79c"), true, 1.f, TEXT("Superficie"), TEXT("f"), TEXT("reproductor")},
		{TEXT("piel"), TEXT("Piel y regiones"), TEXT("d29f82"), false, .35f, TEXT("Superficie"), TEXT("m"), TEXT("")},
		{TEXT("piel_f"), TEXT("Piel y regiones"), TEXT("d29f82"), false, .35f, TEXT("Superficie"), TEXT("f"), TEXT("piel")},
		{TEXT("f_piel"), TEXT("Piel"), TEXT("d6a487"), true, .4f, TEXT("Visible Human · superficie"), TEXT("vh"), TEXT("piel")},
		{TEXT("f_mama"), TEXT("Mama y glándula mamaria"), TEXT("e9c79c"), true, 1.f, TEXT("Visible Human · superficie"), TEXT("vh"), TEXT("reproductor")},
		{TEXT("f_oseo"), TEXT("Pelvis, columna y rodilla"), TEXT("ece2cb"), true, 1.f, TEXT("Visible Human · aparato locomotor"), TEXT("vh"), TEXT("oseo")},
		{TEXT("f_articular"), TEXT("Ligamentos de la rodilla"), TEXT("d3dde6"), false, 1.f, TEXT("Visible Human · aparato locomotor"), TEXT("vh"), TEXT("articular")},
		{TEXT("f_muscular"), TEXT("Músculos del ojo y de la rodilla"), TEXT("a3392f"), false, 1.f, TEXT("Visible Human · aparato locomotor"), TEXT("vh"), TEXT("muscular")},
		{TEXT("f_reproductor"), TEXT("Aparato reproductor femenino"), TEXT("c78a85"), true, 1.f, TEXT("Visible Human · órganos"), TEXT("vh"), TEXT("reproductor")},
		{TEXT("f_visceras"), TEXT("Vísceras torácicas y abdominales"), TEXT("c98b67"), true, 1.f, TEXT("Visible Human · órganos"), TEXT("vh"), TEXT("digestivo")},
		{TEXT("f_vasos"), TEXT("Corazón y vasos sanguíneos"), TEXT("c53a2f"), true, 1.f, TEXT("Visible Human · órganos"), TEXT("vh"), TEXT("arterial")},
		{TEXT("f_nervioso"), TEXT("Encéfalo, médula y nervio óptico"), TEXT("d6b4ab"), false, 1.f, TEXT("Visible Human · sistema nervioso"), TEXT("vh"), TEXT("nervioso_central")},
		{TEXT("f_ojos"), TEXT("Ojos"), TEXT("eee7dc"), false, 1.f, TEXT("Visible Human · sistema nervioso"), TEXT("vh"), TEXT("nervioso_central")},
	};

	FString Cad(const TArray<TSharedPtr<FJsonValue>>& Fila, int32 i)
	{
		FString S;
		if (Fila.IsValidIndex(i) && Fila[i].IsValid()) { Fila[i]->TryGetString(S); }
		return S;
	}
}

FString UCorpusDatos::CarpetaDatos()
{
	return FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Datos"));
}

TSharedPtr<FJsonObject> UCorpusDatos::LeerObjeto(const FString& Archivo)
{
	FString Texto;
	TSharedPtr<FJsonObject> Obj;
	if (!FFileHelper::LoadFileToString(Texto, *FPaths::Combine(CarpetaDatos(), Archivo)))
	{
		UE_LOG(LogCorpus, Warning, TEXT("Falta %s en Content/Datos (ejecuta tools/unreal/exportar.js y corpus_importar.py)"), *Archivo);
		return Obj;
	}
	const TSharedRef<TJsonReader<>> Lector = TJsonReaderFactory<>::Create(Texto);
	FJsonSerializer::Deserialize(Lector, Obj);
	return Obj;
}

bool UCorpusDatos::LeerLista(const FString& Archivo, TArray<TSharedPtr<FJsonValue>>& Fuera)
{
	FString Texto;
	if (!FFileHelper::LoadFileToString(Texto, *FPaths::Combine(CarpetaDatos(), Archivo))) { return false; }
	const TSharedRef<TJsonReader<>> Lector = TJsonReaderFactory<>::Create(Texto);
	return FJsonSerializer::Deserialize(Lector, Fuera);
}

void UCorpusDatos::CargarCatalogo(const FString& Archivo, const FString& Campo)
{
	TArray<TSharedPtr<FJsonValue>> Filas;
	if (Campo.IsEmpty())
	{
		LeerLista(Archivo, Filas);
	}
	else if (const TSharedPtr<FJsonObject> Obj = LeerObjeto(Archivo))
	{
		const TArray<TSharedPtr<FJsonValue>>* P = nullptr;
		if (Obj->TryGetArrayField(Campo, P)) { Filas = *P; }
	}
	for (const TSharedPtr<FJsonValue>& V : Filas)
	{
		const TArray<TSharedPtr<FJsonValue>>* Fila = nullptr;
		if (!V.IsValid() || !V->TryGetArray(Fila) || Fila->Num() < 5) { continue; }
		FCorpusPieza P;
		P.Id = Cad(*Fila, 0);
		if (P.Id.IsEmpty() || Piezas.Contains(P.Id)) { continue; }
		P.En = Cad(*Fila, 1); P.Es = Cad(*Fila, 2); P.La = Cad(*Fila, 3); P.Sistema = Cad(*Fila, 4); P.Lado = Cad(*Fila, 5);
		Piezas.Add(P.Id, MoveTemp(P));
	}
}

void UCorpusDatos::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	for (const FDefCapa& D : DEF_CAPAS)
	{
		FCorpusCapa C;
		C.Clave = D.Clave; C.Nombre = D.Nombre; C.Grupo = D.Grupo; C.bActivaAlInicio = D.bOn; C.Opacidad = D.Op; C.Sexo = D.Sexo;
		C.Base = FString(D.Base).IsEmpty() ? C.Clave : FString(D.Base);
		C.Color = FLinearColor(FColor::FromHex(D.Color));
		ListaCapas.Add(MoveTemp(C));
	}

	CargarCatalogo(TEXT("catalog.json"), FString());
	CargarCatalogo(TEXT("fem.json"), TEXT("cat"));

	// manifiesto.json: qué malla tiene cada pieza en cada cuerpo
	if (const TSharedPtr<FJsonObject> Man = LeerObjeto(TEXT("manifiesto.json")))
	{
		const TSharedPtr<FJsonObject>* PiezasJ = nullptr;
		if (Man->TryGetObjectField(TEXT("piezas"), PiezasJ))
		{
			for (const auto& Par : (*PiezasJ)->Values)
			{
				const TSharedPtr<FJsonObject>* PorCuerpo = nullptr;
				if (!Par.Value.IsValid() || !Par.Value->TryGetObject(PorCuerpo)) { continue; }
				FCorpusPieza& P = Piezas.FindOrAdd(FString(Par.Key));
				if (P.Id.IsEmpty()) { P.Id = FString(Par.Key); P.En = P.Es = P.Id; }
				for (const auto& C : (*PorCuerpo)->Values)
				{
					const TSharedPtr<FJsonObject>* M = nullptr;
					if (!C.Value.IsValid() || !C.Value->TryGetObject(M)) { continue; }
					FCorpusMalla Malla;
					(*M)->TryGetStringField(TEXT("s"), Malla.Sistema);
					double Tri = 0; (*M)->TryGetNumberField(TEXT("t"), Tri); Malla.Triangulos = (int32)Tri;
					const TArray<TSharedPtr<FJsonValue>>* K = nullptr;
					if ((*M)->TryGetArrayField(TEXT("k"), K) && K->Num() == 4)
					{
						// sRGB 0–255 → lineal; el peso (0–255) va en A
						Malla.Tinte = FLinearColor(FColor((uint8)(*K)[0]->AsNumber(), (uint8)(*K)[1]->AsNumber(), (uint8)(*K)[2]->AsNumber()));
						Malla.Tinte.A = (float)(*K)[3]->AsNumber() / 255.f;
					}
					P.Mallas.Add(FString(C.Key), Malla);
					if (P.Sistema.IsEmpty()) { P.Sistema = Malla.Sistema; }
				}
			}
		}
		const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
		if (Man->TryGetArrayField(TEXT("solo_hombre"), L)) { for (const auto& V : *L) { SoloHombre.Add(V->AsString()); } }
		if (Man->TryGetArrayField(TEXT("corazon_oculto"), L)) { for (const auto& V : *L) { CorazonOculto.Add(V->AsString()); } }
	}

	InfoEs = LeerObjeto(TEXT("info.json"));
	UE_LOG(LogCorpus, Log, TEXT("Corpus Atlas: %d estructuras, %d capas"), Piezas.Num(), ListaCapas.Num());
}

const FCorpusCapa* UCorpusDatos::Capa(const FString& Clave) const
{
	return ListaCapas.FindByPredicate([&](const FCorpusCapa& C) { return C.Clave == Clave; });
}

void UCorpusDatos::CargarIdioma(const FString& Codigo)
{
	if (Codigo == TEXT("es") || UiTr.Contains(Codigo)) { return; }
	TSharedPtr<FJsonObject> Ui = MakeShared<FJsonObject>(), Nombres = MakeShared<FJsonObject>();
	const TSharedPtr<FJsonObject>* O = nullptr;
	if (Codigo == TEXT("en") || Codigo == TEXT("pt"))
	{
		// i18n.json: ui.en, ui.pt y names (portugués)
		if (const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("i18n.json")))
		{
			const TSharedPtr<FJsonObject>* UiJ = nullptr;
			if (J->TryGetObjectField(TEXT("ui"), UiJ) && (*UiJ)->TryGetObjectField(Codigo, O)) { Ui = *O; }
			if (Codigo == TEXT("pt") && J->TryGetObjectField(TEXT("names"), O)) { Nombres = *O; }
		}
	}
	else if (const TSharedPtr<FJsonObject> J = LeerObjeto(FString::Printf(TEXT("i18n_%s.json"), *Codigo)))
	{
		if (J->TryGetObjectField(TEXT("ui"), O)) { Ui = *O; }
		if (J->TryGetObjectField(TEXT("names"), O)) { Nombres = *O; }
		// content_fr/de: textos largos (español → traducción); no pisan la interfaz
		if (const TSharedPtr<FJsonObject> Cont = LeerObjeto(FString::Printf(TEXT("content_%s.json"), *Codigo)))
		{
			for (const auto& Par : Cont->Values) { if (!Ui->HasField(Par.Key)) { Ui->SetField(Par.Key, Par.Value); } }
		}
	}
	UiTr.Add(Codigo, Ui);
	NombresTr.Add(Codigo, Nombres);
	if (const TSharedPtr<FJsonObject> Info = LeerObjeto(FString::Printf(TEXT("info_%s.json"), *Codigo))) { InfoTr.Add(Codigo, Info); }
}

void UCorpusDatos::PonerIdioma(const FString& Codigo)
{
	static const TArray<FString> Validos = { TEXT("es"), TEXT("en"), TEXT("pt"), TEXT("fr"), TEXT("de") };
	if (!Validos.Contains(Codigo) || Codigo == IdiomaActual) { return; }
	CargarIdioma(Codigo);
	IdiomaActual = Codigo;
	AlCambiarIdioma.Broadcast();
}

FString UCorpusDatos::T(const FString& Es) const
{
	if (IdiomaActual != TEXT("es"))
	{
		FString Tr;
		if (const TSharedPtr<FJsonObject>* Ui = UiTr.Find(IdiomaActual)) { if ((*Ui)->TryGetStringField(Es, Tr) && !Tr.IsEmpty()) { return Tr; } }
		// francés y alemán caen en inglés si falta el texto (igual que la web)
		if (IdiomaActual == TEXT("fr") || IdiomaActual == TEXT("de"))
		{
			if (const TSharedPtr<FJsonObject>* En = UiTr.Find(TEXT("en"))) { if ((*En)->TryGetStringField(Es, Tr) && !Tr.IsEmpty()) { return Tr; } }
		}
	}
	return Es;
}

FString UCorpusDatos::NombrePieza(const FString& Id) const
{
	const FCorpusPieza* P = Piezas.Find(Id);
	if (!P) { return Id; }
	if (IdiomaActual == TEXT("es")) { return P->Es; }
	if (IdiomaActual == TEXT("en")) { return P->En; }
	FString Tr;
	if (const TSharedPtr<FJsonObject>* N = NombresTr.Find(IdiomaActual)) { if ((*N)->TryGetStringField(P->Es, Tr) && !Tr.IsEmpty()) { return Tr; } }
	return IdiomaActual == TEXT("pt") ? P->Es : P->En;
}

FString UCorpusDatos::NombreCapa(const FString& Clave) const
{
	const FCorpusCapa* C = Capa(Clave);
	return C ? T(C->Nombre) : Clave;
}

FString UCorpusDatos::NombreLado(const FString& Lado) const
{
	return Lado.IsEmpty() ? FString() : T(Lado);
}

TArray<TPair<FString, FString>> UCorpusDatos::Ficha(const FString& Id)
{
	TArray<TPair<FString, FString>> Fuera;
	const FCorpusPieza* P = Piezas.Find(Id);
	if (!P || !InfoEs.IsValid()) { return Fuera; }
	// info.json: { mus|lig|bone|rest : { nombre inglés : { campo : texto } } }
	FString Tipo;
	TSharedPtr<FJsonObject> F;
	for (const auto& Grupo : InfoEs->Values)
	{
		const TSharedPtr<FJsonObject>* G = nullptr;
		const TSharedPtr<FJsonObject>* E = nullptr;
		if (Grupo.Value.IsValid() && Grupo.Value->TryGetObject(G) && (*G)->TryGetObjectField(P->En, E)) { Tipo = FString(Grupo.Key); F = *E; break; }
	}
	if (!F.IsValid()) { return Fuera; }
	if (IdiomaActual != TEXT("es"))
	{
		const FString Clave = Tipo + TEXT("|") + P->En;
		const TSharedPtr<FJsonObject>* Tr = nullptr;
		const TSharedPtr<FJsonObject>* E = nullptr;
		if ((Tr = InfoTr.Find(IdiomaActual)) != nullptr && (*Tr)->TryGetObjectField(Clave, E)) { F = *E; }
		else if ((Tr = InfoTr.Find(TEXT("en"))) != nullptr && (*Tr)->TryGetObjectField(Clave, E)) { F = *E; }
	}
	static const TMap<FString, FString> Etiquetas = {
		{TEXT("tipo"), TEXT("Tipo")}, {TEXT("descripcion"), TEXT("Descripción")}, {TEXT("origen"), TEXT("Origen")}, {TEXT("insercion"), TEXT("Inserción")},
		{TEXT("inervacion"), TEXT("Inervación")}, {TEXT("irrigacion"), TEXT("Irrigación")}, {TEXT("accion"), TEXT("Acción")}, {TEXT("funcion"), TEXT("Función")},
		{TEXT("articulacion"), TEXT("Articulación")}, {TEXT("une"), TEXT("Une")}, {TEXT("destino"), TEXT("Destino")}, {TEXT("ramas"), TEXT("Ramas")},
		{TEXT("territorio"), TEXT("Territorio")}, {TEXT("clinica"), TEXT("Clínica")}, {TEXT("relaciones"), TEXT("Relaciones")}
	};
	for (const auto& Campo : F->Values)
	{
		const FString K(Campo.Key);
		FString Texto;
		if (K == TEXT("es") || K == TEXT("la") || !Campo.Value.IsValid() || !Campo.Value->TryGetString(Texto) || Texto.IsEmpty()) { continue; }
		const FString* Et = Etiquetas.Find(K);
		Fuera.Emplace(T(Et ? *Et : K.Left(1).ToUpper() + K.Mid(1)), Texto);
	}
	return Fuera;
}

FString UCorpusDatos::Plano(const FString& S)
{
	FString R = S.ToLower();
	static const TCHAR* Con = TEXT("áàâãäéèêëíìîïóòôõöúùûüñç");
	static const TCHAR* Sin = TEXT("aaaaaeeeeiiiiooooouuuunc");
	for (int32 i = 0; Con[i]; ++i) { R.ReplaceCharInline(Con[i], Sin[i]); }
	return R;
}

TArray<FString> UCorpusDatos::Buscar(const FString& Texto, int32 Maximo) const
{
	TArray<FString> Empiezan, Contienen;
	const FString Q = Plano(Texto.TrimStartAndEnd());
	if (Q.Len() < 2) { return Empiezan; }
	for (const auto& Par : Piezas)
	{
		const FCorpusPieza& P = Par.Value;
		if (P.Mallas.Num() == 0) { continue; }
		const FString N = Plano(NombrePieza(P.Id));
		if (N.StartsWith(Q)) { Empiezan.Add(P.Id); }
		else if (N.Contains(Q) || Plano(P.Es).Contains(Q) || Plano(P.En).Contains(Q) || Plano(P.La).Contains(Q)) { Contienen.Add(P.Id); }
		if (Empiezan.Num() >= Maximo) { break; }
	}
	Empiezan.Append(Contienen);
	if (Empiezan.Num() > Maximo) { Empiezan.SetNum(Maximo); }
	return Empiezan;
}
