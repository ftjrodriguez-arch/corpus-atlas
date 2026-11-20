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
	CargarMovimiento();
	UE_LOG(LogCorpus, Log, TEXT("Corpus Atlas: %d estructuras, %d capas, %d articulaciones, %d rangos"), Piezas.Num(), ListaCapas.Num(), Pivotes.Num(), ListaRangos.Num());
}

// movimiento.json (tools/unreal/movimiento.js): articulaciones con su pivote y, por cada movimiento de la tabla ROM de la web,
// la postura cada 5° y por lado: lista plana de 8 números por articulación [índice, eje xyz, ángulo, traslación xyz] (glTF, m).
void UCorpusDatos::CargarMovimiento()
{
	const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("movimiento.json"));
	if (!J) { return; }
	IndiceTronco = (int32)J->GetNumberField(TEXT("ax"));
	const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
	if (J->TryGetArrayField(TEXT("articulaciones"), A))
	{
		for (const auto& V : *A)
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			const TArray<TSharedPtr<FJsonValue>>& P = O->GetArrayField(TEXT("pivote"));
			NombresArt.Add(O->GetStringField(TEXT("id")));
			Pivotes.Add(FVector3f((float)P[0]->AsNumber(), (float)P[1]->AsNumber(), (float)P[2]->AsNumber()));
		}
	}
	const auto LeerFrames = [](const TSharedPtr<FJsonObject>& M, const TCHAR* Lado, TArray<TArray<float>>& Fuera)
	{
		const TArray<TSharedPtr<FJsonValue>>* F = nullptr;
		if (!M->TryGetArrayField(Lado, F)) { return; }
		for (const auto& Fr : *F)
		{
			TArray<float>& Dst = Fuera.AddDefaulted_GetRef();
			for (const auto& X : Fr->AsArray()) { Dst.Add((float)X->AsNumber()); }
		}
	};
	// huecos de cada pieza: «cuerpo/id» → hasta 8 códigos de articulación (± a + 32·b + 1024·c), datos primitivos 12–19
	const TSharedPtr<FJsonObject>* PJ = nullptr;
	if (J->TryGetObjectField(TEXT("piezas"), PJ))
	{
		for (const auto& Cu : (*PJ)->Values)
		{
			const TSharedPtr<FJsonObject>* PorId = nullptr;
			if (!Cu.Value.IsValid() || !Cu.Value->TryGetObject(PorId)) { continue; }
			for (const auto& Pz : (*PorId)->Values)
			{
				TArray<float>& H = Huecos.Add(FString(Cu.Key) + TEXT("/") + FString(Pz.Key));
				for (const auto& X : Pz.Value->AsArray()) { H.Add((float)X->AsNumber()); }
			}
		}
	}
	// contorno real de la parrilla costal (tools/unreal/torax.js): radio por altura y sector angular → filas 4… de la textura de postura
	const TSharedPtr<FJsonObject>* TJ = nullptr;
	if (J->TryGetObjectField(TEXT("torax"), TJ))
	{
		const TArray<TSharedPtr<FJsonValue>>* Filas = nullptr;
		if ((*TJ)->TryGetArrayField(TEXT("r"), Filas))
		{
			for (const auto& F : *Filas)
			{
				TArray<float>& Dst = Torax.AddDefaulted_GetRef();
				for (const auto& X : F->AsArray()) { Dst.Add((float)X->AsNumber()); }
			}
		}
	}
	// punto de inserción de las piezas de fibra tensa (dorsal ancho, pectoral mayor): «cuerpo/id» → xyz en glTF
	const TSharedPtr<FJsonObject>* IJ = nullptr;
	if (J->TryGetObjectField(TEXT("insercion"), IJ))
	{
		for (const auto& Cu : (*IJ)->Values)
		{
			const TSharedPtr<FJsonObject>* PorId = nullptr;
			if (!Cu.Value.IsValid() || !Cu.Value->TryGetObject(PorId)) { continue; }
			for (const auto& Pz : (*PorId)->Values)
			{
				const TArray<TSharedPtr<FJsonValue>>& V = Pz.Value->AsArray();
				if (V.Num() == 3) { Insercion.Add(FString(Cu.Key) + TEXT("/") + FString(Pz.Key), FVector3f((float)V[0]->AsNumber(), (float)V[1]->AsNumber(), (float)V[2]->AsNumber())); }
			}
		}
	}
	const TSharedPtr<FJsonObject>* AJ = nullptr;
	if (J->TryGetObjectField(TEXT("abrazo"), AJ))
	{
		for (const auto& Cu : (*AJ)->Values)
		{
			const TArray<TSharedPtr<FJsonValue>>* Ids = nullptr;
			if (Cu.Value.IsValid() && Cu.Value->TryGetArray(Ids)) { for (const auto& X : *Ids) { Abrazo.Add(FString(Cu.Key) + TEXT("/") + X->AsString()); } }
		}
	}
	// marcha: fases, grupos musculares y patrones con sus instantes cada PasoCiclo % del ciclo
	const TSharedPtr<FJsonObject>* MJ = nullptr;
	if (J->TryGetObjectField(TEXT("marcha"), MJ))
	{
		const TSharedPtr<FJsonObject>& Ma = *MJ;
		double Ps = 2; Ma->TryGetNumberField(TEXT("paso"), Ps); PasoCiclo = (float)Ps;
		const auto Cadenas = [](const TSharedPtr<FJsonObject>& O, const TCHAR* Campo, TArray<FString>& Fuera)
		{
			const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
			if (O->TryGetArrayField(Campo, L)) { for (const auto& X : *L) { Fuera.Add(X->AsString()); } }
		};
		const auto Numeros = [](const TSharedPtr<FJsonObject>& O, const TCHAR* Campo, TArray<TArray<float>>& Fuera)
		{
			const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
			if (!O->TryGetArrayField(Campo, L)) { return; }
			for (const auto& Fr : *L) { TArray<float>& D = Fuera.AddDefaulted_GetRef(); for (const auto& X : Fr->AsArray()) { D.Add((float)X->AsNumber()); } }
		};
		const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
		if (Ma->TryGetArrayField(TEXT("fases"), L))
		{
			for (const auto& V : *L)
			{
				const TArray<TSharedPtr<FJsonValue>>& F = V->AsArray();
				FCorpusFaseMarcha& Fa = Fases.AddDefaulted_GetRef();
				Fa.Ini = (float)F[0]->AsNumber(); Fa.Fin = (float)F[1]->AsNumber(); Fa.Nombre = F[2]->AsString(); Fa.Abrev = F[3]->AsString(); Fa.Texto = F[4]->AsString();
			}
		}
		if (Ma->TryGetArrayField(TEXT("grupos"), L))
		{
			for (const auto& V : *L)
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				FCorpusGrupoMarcha& G = Grupos.AddDefaulted_GetRef();
				Cadenas(O, TEXT("en"), G.En); G.Nombre = O->GetStringField(TEXT("n")); G.Texto = O->GetStringField(TEXT("txt"));
				const TArray<TSharedPtr<FJsonValue>>* Lv = nullptr;
				if (O->TryGetArrayField(TEXT("lv"), Lv)) { for (const auto& Pt : *Lv) { const auto& Par2 = Pt->AsArray(); G.Nivel.Add(FVector2f((float)Par2[0]->AsNumber(), (float)Par2[1]->AsNumber())); } }
			}
		}
		if (Ma->TryGetArrayField(TEXT("patrones"), L))
		{
			for (const auto& V : *L)
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				FCorpusPatronMarcha& P = Patrones.AddDefaulted_GetRef();
				P.Id = O->GetStringField(TEXT("id")); P.Nombre = O->GetStringField(TEXT("n")); P.Texto = O->GetStringField(TEXT("t"));
				double Ve = 1; O->TryGetNumberField(TEXT("vel"), Ve); P.Velocidad = (float)Ve;
				Cadenas(O, TEXT("debiles"), P.Debiles); Cadenas(O, TEXT("espasticos"), P.Espasticos);
				Numeros(O, TEXT("frames"), P.Frames); Numeros(O, TEXT("raiz"), P.Raiz);
			}
		}
	}
	const TArray<TSharedPtr<FJsonValue>>* R = nullptr;
	if (J->TryGetArrayField(TEXT("rom"), R))
	{
		for (const auto& V : *R)
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			FCorpusRango& Rg = ListaRangos.AddDefaulted_GetRef();
			Rg.Id = O->GetStringField(TEXT("id"));
			Rg.Nombre = O->GetStringField(TEXT("n"));
			O->TryGetBoolField(TEXT("lados"), Rg.bLados);
			for (const auto& MV : O->GetArrayField(TEXT("movs")))
			{
				const TSharedPtr<FJsonObject> M = MV->AsObject();
				FCorpusMovimiento& Mv = Rg.Movs.AddDefaulted_GetRef();
				Mv.Nombre = M->GetStringField(TEXT("n"));
				Mv.Max = (float)M->GetNumberField(TEXT("max"));
				Mv.Paso = (float)M->GetNumberField(TEXT("paso"));
				for (const auto& Ag : M->GetArrayField(TEXT("ag"))) { Mv.Agonistas.Add(Ag->AsString()); }
				LeerFrames(M, TEXT("R"), Mv.Derecho);
				LeerFrames(M, TEXT("L"), Mv.Izquierdo);
			}
		}
	}
}

const FCorpusCapa* UCorpusDatos::Capa(const FString& Clave) const
{
	return ListaCapas.FindByPredicate([&](const FCorpusCapa& C) { return C.Clave == Clave; });
}

namespace
{
	// El lector JSON de Unreal guarda las claves sin distinguir mayúsculas; aquí se leen tal cual vienen en el archivo.
	void Volcar(const TSharedPtr<FJsonObject>& O, FTablaTr& T, bool bPisar)
	{
		if (!O.IsValid()) { return; }
		for (const auto& Par : O->Values)
		{
			FString S;
			if (!Par.Value.IsValid() || !Par.Value->TryGetString(S) || S.IsEmpty()) { continue; }
			const FString K(Par.Key);
			if (bPisar || !T.Contains(K)) { T.Add(K, S); }
		}
	}

	// Textos propios de esta edición que no están en los JSON de la web: es → en, pt, fr, de.
	struct FTrPropia { const TCHAR* Es; const TCHAR* L[4]; };
	const FTrPropia TR_PROPIA[] = {
		{TEXT("Respiratorio"), {TEXT("Respiratory"), TEXT("Respiratório"), TEXT("Respiratoire"), TEXT("Atmungssystem")}},
		{TEXT("Digestivo"), {TEXT("Digestive"), TEXT("Digestório"), TEXT("Digestif"), TEXT("Verdauungssystem")}},
		{TEXT("Urinario"), {TEXT("Urinary"), TEXT("Urinário"), TEXT("Urinaire"), TEXT("Harnsystem")}},
		{TEXT("Reproductor"), {TEXT("Reproductive"), TEXT("Reprodutor"), TEXT("Reproducteur"), TEXT("Geschlechtsorgane")}},
		{TEXT("Endocrino"), {TEXT("Endocrine"), TEXT("Endócrino"), TEXT("Endocrinien"), TEXT("Endokrines System")}},
		{TEXT("Ojos"), {TEXT("Eyes"), TEXT("Olhos"), TEXT("Yeux"), TEXT("Augen")}},
		{TEXT("Derecha"), {TEXT("Right"), TEXT("Direita"), TEXT("Droite"), TEXT("Rechts")}},
		{TEXT("Izquierda"), {TEXT("Left"), TEXT("Esquerda"), TEXT("Gauche"), TEXT("Links")}},
		{TEXT("izquierdo"), {TEXT("left"), TEXT("esquerdo"), TEXT("gauche"), TEXT("links")}},
		{TEXT("Mostrar todo"), {TEXT("Show all"), TEXT("Mostrar tudo"), TEXT("Tout afficher"), TEXT("Alles zeigen")}},
		{TEXT("Encuadrar"), {TEXT("Frame"), TEXT("Enquadrar"), TEXT("Cadrer"), TEXT("Einpassen")}},
		{TEXT("Buscar estructura…"), {TEXT("Search structure…"), TEXT("Buscar estrutura…"), TEXT("Rechercher une structure…"), TEXT("Struktur suchen…")}},
		{TEXT("Atlas anatómico 3D libre"), {TEXT("Free 3D anatomy atlas"), TEXT("Atlas anatômico 3D livre"), TEXT("Atlas d'anatomie 3D libre"), TEXT("Freier 3D-Anatomieatlas")}},
		{TEXT("Sin resultados"), {TEXT("No results"), TEXT("Sem resultados"), TEXT("Aucun résultat"), TEXT("Keine Ergebnisse")}},
		{TEXT("Descripción"), {TEXT("Description"), TEXT("Descrição"), TEXT("Description"), TEXT("Beschreibung")}},
		{TEXT("Une"), {TEXT("Connects"), TEXT("Une"), TEXT("Relie"), TEXT("Verbindet")}},
		{TEXT("Destino"), {TEXT("Destination"), TEXT("Destino"), TEXT("Destination"), TEXT("Ziel")}},
		{TEXT("Ramas"), {TEXT("Branches"), TEXT("Ramos"), TEXT("Branches"), TEXT("Äste")}},
		{TEXT("Territorio"), {TEXT("Territory"), TEXT("Território"), TEXT("Territoire"), TEXT("Versorgungsgebiet")}},
		{TEXT("Clínica"), {TEXT("Clinical notes"), TEXT("Clínica"), TEXT("Clinique"), TEXT("Klinik")}},
		{TEXT("Relaciones"), {TEXT("Relations"), TEXT("Relações"), TEXT("Rapports"), TEXT("Lagebeziehungen")}},
	};

	bool BuscarPropia(const FString& Idioma, const FString& Es, FString& Fuera)
	{
		static const TArray<FString> Orden = { TEXT("en"), TEXT("pt"), TEXT("fr"), TEXT("de") };
		const int32 i = Orden.IndexOfByKey(Idioma);
		if (i == INDEX_NONE) { return false; }
		for (const FTrPropia& P : TR_PROPIA) { if (Es.Equals(P.Es, ESearchCase::CaseSensitive)) { Fuera = P.L[i]; return true; } }
		return false;
	}
}

void UCorpusDatos::CargarIdioma(const FString& Codigo)
{
	if (Codigo == TEXT("es") || UiTr.Contains(Codigo)) { return; }
	FTablaTr Ui, Nombres;
	const TSharedPtr<FJsonObject>* O = nullptr;
	if (Codigo == TEXT("en") || Codigo == TEXT("pt"))
	{
		// i18n.json: ui.en, ui.pt y names (portugués)
		if (const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("i18n.json")))
		{
			const TSharedPtr<FJsonObject>* UiJ = nullptr;
			if (J->TryGetObjectField(TEXT("ui"), UiJ) && (*UiJ)->TryGetObjectField(Codigo, O)) { Volcar(*O, Ui, true); UiAprox.Add(Codigo, *O); }
			if (Codigo == TEXT("pt") && J->TryGetObjectField(TEXT("names"), O)) { Volcar(*O, Nombres, true); }
		}
	}
	else if (const TSharedPtr<FJsonObject> J = LeerObjeto(FString::Printf(TEXT("i18n_%s.json"), *Codigo)))
	{
		if (J->TryGetObjectField(TEXT("ui"), O)) { Volcar(*O, Ui, true); UiAprox.Add(Codigo, *O); }
		if (J->TryGetObjectField(TEXT("names"), O)) { Volcar(*O, Nombres, true); }
		// content_fr/de: textos largos (español → traducción); no pisan la interfaz
		Volcar(LeerObjeto(FString::Printf(TEXT("content_%s.json"), *Codigo)), Ui, false);
	}
	UiTr.Add(Codigo, MoveTemp(Ui));
	NombresTr.Add(Codigo, MoveTemp(Nombres));
	if (const TSharedPtr<FJsonObject> Info = LeerObjeto(FString::Printf(TEXT("info_%s.json"), *Codigo))) { InfoTr.Add(Codigo, Info); }
	// francés y alemán caen en inglés si falta el texto
	if (Codigo == TEXT("fr") || Codigo == TEXT("de")) { CargarIdioma(TEXT("en")); }
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
	if (IdiomaActual == TEXT("es")) { return Es; }
	// Mismo orden que trW() en la web: interfaz → (fr/de) nombres → textos propios → (fr/de) inglés.
	// Antes del inglés, la interfaz sin distinguir mayúsculas: el lector JSON de Unreal funde «Hombre» y «hombre»
	// en una sola clave (la última), así que la búsqueda exacta puede no encontrar «Hombre».
	const bool bFrDe = IdiomaActual == TEXT("fr") || IdiomaActual == TEXT("de");
	if (const FTablaTr* Ui = UiTr.Find(IdiomaActual)) { if (const FString* S = Ui->Find(Es)) { return *S; } }
	if (bFrDe) { if (const FTablaTr* N = NombresTr.Find(IdiomaActual)) { if (const FString* S = N->Find(Es)) { return *S; } } }
	FString Tr;
	if (BuscarPropia(IdiomaActual, Es, Tr)) { return Tr; }
	if (const TSharedPtr<FJsonObject>* A = UiAprox.Find(IdiomaActual)) { if ((*A)->TryGetStringField(Es, Tr) && !Tr.IsEmpty()) { return Tr; } }
	if (bFrDe) { if (const FTablaTr* En = UiTr.Find(TEXT("en"))) { if (const FString* S = En->Find(Es)) { return *S; } } }
	return Es;
}

FString UCorpusDatos::NombrePieza(const FString& Id) const
{
	const FCorpusPieza* P = Piezas.Find(Id);
	if (!P) { return Id; }
	if (IdiomaActual == TEXT("es")) { return P->Es; }
	if (IdiomaActual == TEXT("en")) { return P->En; }
	if (const FTablaTr* N = NombresTr.Find(IdiomaActual)) { if (const FString* S = N->Find(P->Es)) { return *S; } }
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
	// Orden: empieza por el texto → lo contiene → orígenes e inserciones (llevan el mismo nombre que el músculo
	// y antes tapaban al propio músculo en la lista)
	TArray<FString> Empiezan, Contienen, Inserciones;
	const FString Q = Plano(Texto.TrimStartAndEnd());
	if (Q.Len() < 2) { return Empiezan; }
	for (const auto& Par : Piezas)
	{
		const FCorpusPieza& P = Par.Value;
		if (P.Mallas.Num() == 0) { continue; }
		const FString N = Plano(NombrePieza(P.Id));
		const bool bEmpieza = N.StartsWith(Q);
		if (!bEmpieza && !(N.Contains(Q) || Plano(P.Es).Contains(Q) || Plano(P.En).Contains(Q) || Plano(P.La).Contains(Q))) { continue; }
		(P.Sistema == TEXT("insercion") ? Inserciones : bEmpieza ? Empiezan : Contienen).Add(P.Id);
	}
	Empiezan.Append(Contienen);
	Empiezan.Append(Inserciones);
	if (Empiezan.Num() > Maximo) { Empiezan.SetNum(Maximo); }
	return Empiezan;
}
