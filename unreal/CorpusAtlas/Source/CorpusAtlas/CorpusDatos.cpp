#include "CorpusDatos.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogCorpus, Log, All);

namespace
{
	struct FDefCapa { const TCHAR* Clave; const TCHAR* Nombre; const TCHAR* Color; bool bOn; float Op; const TCHAR* Grupo; const TCHAR* Sexo; const TCHAR* Base; };
	// Misma tabla que SYS en index.html (orden, nombres, colores y opacidad). A diferencia de la web, aquí arrancan encendidos
	// los ligamentos, cápsulas y discos y las bolsas y vainas (petición del usuario: al abrir no se veían). Las fascias siguen
	// apagadas porque las de envoltura (fascia lata, crural, braquial…) tapan los músculos.
	const FDefCapa DEF_CAPAS[] = {
		{TEXT("oseo"), TEXT("Huesos, cartílagos y dientes"), TEXT("ece2cb"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("muscular"), TEXT("Músculos"), TEXT("a3392f"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("insercion"), TEXT("Orígenes e inserciones"), TEXT("2f9e5b"), false, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("articular"), TEXT("Ligamentos, cápsulas y discos"), TEXT("d3dde6"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("fascia"), TEXT("Fascias y retináculos"), TEXT("cdb594"), false, .7f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
		{TEXT("bolsas"), TEXT("Bolsas sinoviales y vainas"), TEXT("8fb7c9"), true, 1.f, TEXT("Aparato locomotor"), TEXT(""), TEXT("")},
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
		P.En = Cad(*Fila, 1); P.Es = Cad(*Fila, 2); P.La = Cad(*Fila, 3); P.Sistema = Cad(*Fila, 4); P.Lado = Cad(*Fila, 5); P.Rol = Cad(*Fila, 6);
		if (Fila->Num() > 7) { P.EnPropio = Cad(*Fila, 7); }
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
	CargarCorrectivos();
	CargarExtras();
	CargarInserciones();
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
				if (O->TryGetArrayField(TEXT("tramos"), Lv)) { for (const auto& Pt : *Lv) { const auto& Par2 = Pt->AsArray(); if (Par2.Num() == 2) { G.Tramos.Add(FVector2f((float)Par2[0]->AsNumber(), (float)Par2[1]->AsNumber())); } } }
				const TSharedPtr<FJsonObject>* Tp = nullptr;
				if (O->TryGetObjectField(TEXT("tipo"), Tp))
				{
					for (const auto& Par2 : (*Tp)->Values) { G.Tipo.Emplace(FCString::Atof(*FString(Par2.Key)), Par2.Value->AsString()); }
					G.Tipo.Sort([](const TPair<float, FString>& A, const TPair<float, FString>& B) { return A.Key < B.Key; });
				}
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
	// ejercicios: interfaz y lista (fases, grupos, variantes con sus fotogramas y textos), todo por idiomas
	const TSharedPtr<FJsonObject>* EJ = nullptr;
	if (J->TryGetObjectField(TEXT("ejercicios"), EJ))
	{
		const auto Texto = [](const TSharedPtr<FJsonObject>& O, FCorpusTexto& Fuera)
		{
			if (!O.IsValid()) { return; }
			for (const auto& Par : O->Values) { FString S; if (Par.Value.IsValid() && Par.Value->TryGetString(S)) { Fuera.Add(FString(Par.Key), S); } }
		};
		const auto TextoDe = [&Texto](const TSharedPtr<FJsonObject>& O, const TCHAR* Campo, FCorpusTexto& Fuera)
		{
			const TSharedPtr<FJsonObject>* T = nullptr;
			if (O->TryGetObjectField(Campo, T)) { Texto(*T, Fuera); }
		};
		const auto Tabla = [](const TSharedPtr<FJsonObject>& O, const TCHAR* Campo, TArray<TArray<float>>& Fuera)
		{
			const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
			if (!O->TryGetArrayField(Campo, L)) { return; }
			for (const auto& Fr : *L) { TArray<float>& D = Fuera.AddDefaulted_GetRef(); for (const auto& X : Fr->AsArray()) { D.Add((float)X->AsNumber()); } }
		};
		const TSharedPtr<FJsonObject>* Ui = nullptr;
		if ((*EJ)->TryGetObjectField(TEXT("ui"), Ui))
		{
			for (const auto& Par : (*Ui)->Values) { const TSharedPtr<FJsonObject>* T = nullptr; if (Par.Value.IsValid() && Par.Value->TryGetObject(T)) { Texto(*T, UiEjercicios.Add(FString(Par.Key))); } }
		}
		const TArray<TSharedPtr<FJsonValue>>* Lista = nullptr;
		if ((*EJ)->TryGetArrayField(TEXT("lista"), Lista))
		{
			for (const auto& V : *Lista)
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				if (!O.IsValid()) { continue; }
				FCorpusEjercicio& E = ListaEjercicios.AddDefaulted_GetRef();
				E.Id = O->GetStringField(TEXT("id")); TextoDe(O, TEXT("n"), E.Nombre);
				double N = 0;
				if (O->TryGetNumberField(TEXT("paso"), N)) { E.Paso = FMath::Max(0.1f, (float)N); }
				if (O->TryGetNumberField(TEXT("duracion"), N)) { E.Duracion = FMath::Max(0.5f, (float)N); }
				if (O->TryGetNumberField(TEXT("vista"), N)) { E.Vista = (int32)N; }
				if (O->TryGetNumberField(TEXT("inicial"), N)) { E.Inicial = (int32)N; }
				const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
				if (O->TryGetArrayField(TEXT("fases"), L))
				{
					for (const auto& FV : *L)
					{
						const TSharedPtr<FJsonObject> F = FV->AsObject();
						FCorpusFaseEj& Fa = E.Fases.AddDefaulted_GetRef();
						Fa.Ini = (float)F->GetNumberField(TEXT("ini")); Fa.Fin = (float)F->GetNumberField(TEXT("fin"));
						F->TryGetStringField(TEXT("tipo"), Fa.Tipo); TextoDe(F, TEXT("n"), Fa.Nombre); TextoDe(F, TEXT("x"), Fa.Texto);
					}
				}
				if (O->TryGetArrayField(TEXT("grupos"), L))
				{
					for (const auto& GV : *L)
					{
						const TSharedPtr<FJsonObject> G = GV->AsObject();
						FCorpusGrupoEj& Gr = E.Grupos.AddDefaulted_GetRef();
						TextoDe(G, TEXT("n"), Gr.Nombre); TextoDe(G, TEXT("x"), Gr.Texto);
						const TArray<TSharedPtr<FJsonValue>>* A2 = nullptr;
						if (G->TryGetArrayField(TEXT("en"), A2)) { for (const auto& X : *A2) { Gr.En.Add(X->AsString()); } }
						if (G->TryGetArrayField(TEXT("tipo"), A2)) { for (const auto& X : *A2) { Gr.Tipo.Add(X->AsString()); } }
						if (G->TryGetArrayField(TEXT("lv"), A2)) { for (const auto& X : *A2) { Gr.Nivel.Add((float)X->AsNumber()); } }
					}
				}
				if (O->TryGetArrayField(TEXT("medidas"), L)) { for (const auto& MV : *L) { Texto(MV->AsObject(), E.Medidas.AddDefaulted_GetRef()); } }
				if (O->TryGetArrayField(TEXT("variantes"), L))
				{
					for (const auto& VV : *L)
					{
						const TSharedPtr<FJsonObject> Va = VV->AsObject();
						FCorpusVarianteEj& Vr = E.Variantes.AddDefaulted_GetRef();
						Vr.Id = Va->GetStringField(TEXT("id")); TextoDe(Va, TEXT("n"), Vr.Nombre);
						Tabla(Va, TEXT("frames"), Vr.Frames); Tabla(Va, TEXT("raiz"), Vr.Raiz); Tabla(Va, TEXT("med"), Vr.Medidas);
					}
				}
				if (O->TryGetArrayField(TEXT("textos"), L))
				{
					for (const auto& TV : *L)
					{
						const TArray<TSharedPtr<FJsonValue>>& Par = TV->AsArray();
						if (Par.Num() != 2) { continue; }
						TPair<FCorpusTexto, FCorpusTexto>& T2 = E.Textos.AddDefaulted_GetRef();
						Texto(Par[0]->AsObject(), T2.Key); Texto(Par[1]->AsObject(), T2.Value);
					}
				}
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
				// textos propios de la edición (tools/unreal/rangos_extra.json): nombre y nota por idioma
				const TSharedPtr<FJsonObject>* Tx = nullptr;
				if (M->TryGetObjectField(TEXT("tr"), Tx)) { for (const auto& Par : (*Tx)->Values) { FString S; if (Par.Value.IsValid() && Par.Value->TryGetString(S)) { Mv.Nombres.Add(FString(Par.Key), S); } } }
				if (M->TryGetObjectField(TEXT("nota"), Tx)) { for (const auto& Par : (*Tx)->Values) { FString S; if (Par.Value.IsValid() && Par.Value->TryGetString(S)) { Mv.Notas.Add(FString(Par.Key), S); } } }
				LeerFrames(M, TEXT("R"), Mv.Derecho);
				LeerFrames(M, TEXT("L"), Mv.Izquierdo);
			}
		}
	}
}

// extras.json (el mismo de la web): «dep» = profundidad de disección de cada músculo (s, i, p) y «lm» = relieves de cada
// hueso: [nombre español, inglés, [x, y, z] en glTF (m), portugués].
void UCorpusDatos::CargarExtras()
{
	const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("extras.json"));
	if (!J) { return; }
	const TSharedPtr<FJsonObject>* O = nullptr;
	if (J->TryGetObjectField(TEXT("dep"), O))
	{
		for (const auto& Par : (*O)->Values) { FString S; if (Par.Value.IsValid() && Par.Value->TryGetString(S)) { Prof.Add(FString(Par.Key), S); } }
	}
	if (J->TryGetObjectField(TEXT("lm"), O))
	{
		for (const auto& Par : (*O)->Values)
		{
			const TArray<TSharedPtr<FJsonValue>>* Lista = nullptr;
			if (!Par.Value.IsValid() || !Par.Value->TryGetArray(Lista)) { continue; }
			TArray<FCorpusRelieve>& Rs = RelievesPorHueso.Add(FString(Par.Key));
			for (const auto& V : *Lista)
			{
				const TArray<TSharedPtr<FJsonValue>>* F = nullptr;
				const TArray<TSharedPtr<FJsonValue>>* P = nullptr;
				if (!V.IsValid() || !V->TryGetArray(F) || F->Num() < 3 || !(*F)[2].IsValid() || !(*F)[2]->TryGetArray(P) || P->Num() != 3) { continue; }
				FCorpusRelieve& R = Rs.AddDefaulted_GetRef();
				R.Es = Cad(*F, 0); R.En = Cad(*F, 1); R.Pt = Cad(*F, 3);
				R.Pos = FVector3f((float)(*P)[0]->AsNumber(), (float)(*P)[1]->AsNumber(), (float)(*P)[2]->AsNumber());
			}
		}
	}
	UE_LOG(LogCorpus, Log, TEXT("Corpus Atlas: %d músculos con profundidad y %d huesos con relieves"), Prof.Num(), RelievesPorHueso.Num());
}

// inserciones.json (tools/unreal/inserciones.js): { cuerpo: { id del área de origen o inserción: id del hueso } }
void UCorpusDatos::CargarInserciones()
{
	const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("inserciones.json"));
	if (!J) { return; }
	for (const auto& Cu : J->Values)
	{
		const TSharedPtr<FJsonObject>* O = nullptr;
		if (!Cu.Value.IsValid() || !Cu.Value->TryGetObject(O)) { continue; }
		for (const auto& Par : (*O)->Values) { FString H; if (Par.Value.IsValid() && Par.Value->TryGetString(H)) { HuesoDeArea.Add(FString(Cu.Key) + TEXT("/") + FString(Par.Key), H); } }
	}
}

FString UCorpusDatos::NombreRelieve(const FCorpusRelieve& R) const
{
	if (IdiomaActual == TEXT("es")) { return R.Es; }
	if (IdiomaActual == TEXT("en")) { return R.En.IsEmpty() ? R.Es : R.En; }
	if (IdiomaActual == TEXT("pt")) { return R.Pt.IsEmpty() ? R.Es : R.Pt; }
	// francés y alemán: tabla de nombres o de interfaz por el texto español; si no está, inglés
	if (const FTablaTr* N = NombresTr.Find(IdiomaActual)) { if (const FString* S = N->Find(R.Es)) { return *S; } }
	if (const FTablaTr* Ui = UiTr.Find(IdiomaActual)) { if (const FString* S = Ui->Find(R.Es)) { return *S; } }
	return R.En.IsEmpty() ? R.Es : R.En;
}

// correctivos.json + correctivos.bin (tools/unreal/correctivos.js): rejilla elástica de cada músculo del hombro y, por
// movimiento y lado, el desplazamiento y el giro de cada nodo cada 5°.
void UCorpusDatos::CargarCorrectivos()
{
	const FString RutaJ = FPaths::Combine(CarpetaDatos(), TEXT("correctivos.json")), RutaB = FPaths::Combine(CarpetaDatos(), TEXT("correctivos.bin"));
	if (!FPaths::FileExists(RutaJ) || !FPaths::FileExists(RutaB)) { return; }   // opcional: sin él, los músculos usan solo los pesos
	const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("correctivos.json"));
	if (!J || !FFileHelper::LoadFileToArray(CorrBin, *RutaB)) { CorrBin.Reset(); return; }
	double X = 0;
	if (J->TryGetNumberField(TEXT("texeles"), X)) { CorrTexeles = (int32)X; }
	if (J->TryGetNumberField(TEXT("ancho"), X)) { CorrAncho = FMath::Max(1, (int32)X); }
	if (J->TryGetNumberField(TEXT("escala"), X)) { CorrEscala = FMath::Max(1.f, (float)X); }
	const int64 Tam = CorrBin.Num();
	const TSharedPtr<FJsonObject>* PJ = nullptr;
	if (J->TryGetObjectField(TEXT("piezas"), PJ))
	{
		for (const auto& Par : (*PJ)->Values)
		{
			const TSharedPtr<FJsonObject>* O = nullptr;
			if (!Par.Value.IsValid() || !Par.Value->TryGetObject(O)) { continue; }
			FCorpusRejilla R;
			R.Base = (int32)(*O)->GetNumberField(TEXT("base"));
			R.H = (float)(*O)->GetNumberField(TEXT("h"));
			R.Act = (int32)(*O)->GetNumberField(TEXT("act"));
			R.Lista = (int64)(*O)->GetNumberField(TEXT("ai"));
			const TArray<TSharedPtr<FJsonValue>>& N = (*O)->GetArrayField(TEXT("n"));
			const TArray<TSharedPtr<FJsonValue>>& Or = (*O)->GetArrayField(TEXT("o"));
			if (N.Num() != 3 || Or.Num() != 3 || R.H <= 0.f || R.Lista < 0 || R.Lista + (int64)R.Act * 4 > Tam) { continue; }
			R.N = FIntVector((int32)N[0]->AsNumber(), (int32)N[1]->AsNumber(), (int32)N[2]->AsNumber());
			R.O = FVector3f((float)Or[0]->AsNumber(), (float)Or[1]->AsNumber(), (float)Or[2]->AsNumber());
			if (R.Base < 1 || R.Base + R.N.X * R.N.Y * R.N.Z > CorrTexeles) { continue; }
			Rejillas.Add(FString(Par.Key), R);
		}
	}
	const TArray<TSharedPtr<FJsonValue>>* MJ = nullptr;
	if (J->TryGetArrayField(TEXT("movs"), MJ))
	{
		for (const auto& V : *MJ)
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			if (!O) { continue; }
			FCorpusCorrMov M;
			M.Cuadros = (int32)O->GetNumberField(TEXT("cuadros"));
			const TSharedPtr<FJsonObject>* Pz = nullptr;
			if (O->TryGetObjectField(TEXT("piezas"), Pz))
			{
				for (const auto& Par : (*Pz)->Values)
				{
					const FCorpusRejilla* R = Rejillas.Find(FString(Par.Key));
					const int64 Pos = (int64)Par.Value->AsNumber();
					if (R && Pos >= 0 && Pos + (int64)M.Cuadros * R->Act * 14 <= Tam) { M.Piezas.Add(FString(Par.Key), Pos); }
				}
			}
			CorrMovs.Add(FString::Printf(TEXT("%s/%d/%s"), *O->GetStringField(TEXT("rom")), (int32)O->GetNumberField(TEXT("mov")), *O->GetStringField(TEXT("lado"))), MoveTemp(M));
		}
	}
	UE_LOG(LogCorpus, Log, TEXT("Corpus Atlas: correctivos elásticos de %d músculos en %d movimientos"), Rejillas.Num(), CorrMovs.Num());
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

	/** Lee los pares texto → texto de un objeto JSON (Ruta = claves desde la raíz; vacía = la raíz) distinguiendo
	    mayúsculas: recorre los símbolos del lector en vez de usar FJsonObject, cuyo mapa no las distingue. */
	bool LeerParesExactos(const FString& Archivo, const TArray<FString>& Ruta, FTablaTr& T, bool bPisar)
	{
		FString Texto;
		if (!FFileHelper::LoadFileToString(Texto, *FPaths::Combine(UCorpusDatos::CarpetaDatos(), Archivo))) { return false; }
		const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Texto);
		TArray<FString> Pila;   // claves de los objetos abiertos (la raíz no tiene); las listas llevan «[» delante
		EJsonNotation N;
		int32 Leidos = 0;
		while (R->ReadNext(N))
		{
			switch (N)
			{
			case EJsonNotation::ObjectStart: Pila.Add(R->GetIdentifier()); break;
			case EJsonNotation::ArrayStart: Pila.Add(TEXT("[") + R->GetIdentifier()); break;
			case EJsonNotation::ObjectEnd: case EJsonNotation::ArrayEnd: if (Pila.Num() > 0) { Pila.Pop(); } break;
			case EJsonNotation::String:
			{
				if (Pila.Num() != Ruta.Num() + 1) { break; }
				bool bEsta = true;
				for (int32 i = 0; i < Ruta.Num() && bEsta; ++i) { bEsta = Pila[i + 1].Equals(Ruta[i], ESearchCase::CaseSensitive); }
				const FString K = R->GetIdentifier(), V = R->GetValueAsString();
				if (bEsta && !V.IsEmpty() && (bPisar || !T.Contains(K))) { T.Add(K, V); ++Leidos; }
				break;
			}
			case EJsonNotation::Error: return Leidos > 0;
			default: break;
			}
		}
		return Leidos > 0;
	}

	// Textos propios de esta edición que no están en los JSON de la web: es → en, pt, fr, de.
	struct FTrPropia { const TCHAR* Es; const TCHAR* L[4]; };
	const FTrPropia TR_PROPIA[] = {
		{TEXT("máx."), {TEXT("max."), TEXT("máx."), TEXT("max."), TEXT("max.")}},
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
		{TEXT("Excéntrica"), {TEXT("Eccentric"), TEXT("Excêntrica"), TEXT("Excentrique"), TEXT("Exzentrisch")}},
		{TEXT("Concéntrica"), {TEXT("Concentric"), TEXT("Concêntrica"), TEXT("Concentrique"), TEXT("Konzentrisch")}},
		{TEXT("Isométrica"), {TEXT("Isometric"), TEXT("Isométrica"), TEXT("Isométrique"), TEXT("Isometrisch")}},
		{TEXT("Relaciones"), {TEXT("Relations"), TEXT("Relações"), TEXT("Rapports"), TEXT("Lagebeziehungen")}},
		{TEXT("Accidentes óseos"), {TEXT("Bony landmarks"), TEXT("Acidentes ósseos"), TEXT("Reliefs osseux"), TEXT("Knochenpunkte")}},
		{TEXT("Disección"), {TEXT("Dissection"), TEXT("Dissecção"), TEXT("Dissection"), TEXT("Präparation")}},
		{TEXT("Fantasma"), {TEXT("Ghost"), TEXT("Fantasma"), TEXT("Fantôme"), TEXT("Geistermodus")}},
		{TEXT("Plano de corte"), {TEXT("Section plane"), TEXT("Plano de corte"), TEXT("Plan de coupe"), TEXT("Schnittebene")}},
		{TEXT("Coronal"), {TEXT("Coronal"), TEXT("Coronal"), TEXT("Coronal"), TEXT("Koronal")}},
		{TEXT("Axial"), {TEXT("Axial"), TEXT("Axial"), TEXT("Axial"), TEXT("Axial")}},
		{TEXT("Invertir"), {TEXT("Flip"), TEXT("Inverter"), TEXT("Inverser"), TEXT("Umkehren")}},
		{TEXT("Quitar corte"), {TEXT("Remove cut"), TEXT("Remover corte"), TEXT("Retirer la coupe"), TEXT("Schnitt entfernen")}},
		{TEXT("Tamaño del texto"), {TEXT("Text size"), TEXT("Tamanho do texto"), TEXT("Taille du texte"), TEXT("Textgröße")}},
		// ── Interfaz, fase 2 (PLAN_INTERFAZ.md): modos, barra de disección, cruceta de vistas, menús y capas ──
		{TEXT("Explorar"), {TEXT("Explore"), TEXT("Explorar"), TEXT("Explorer"), TEXT("Erkunden")}},
		{TEXT("Movimiento"), {TEXT("Movement"), TEXT("Movimento"), TEXT("Mouvement"), TEXT("Bewegung")}},
		{TEXT("Explorar: capas, fichas y disección"), {TEXT("Explore: layers, structure cards and dissection"), TEXT("Explorar: camadas, fichas e dissecção"), TEXT("Explorer : couches, fiches et dissection"), TEXT("Erkunden: Ebenen, Steckbriefe und Präparation")}},
		{TEXT("Movimiento: rangos articulares, marcha y ejercicios"), {TEXT("Movement: joint ranges, gait and exercises"), TEXT("Movimento: amplitudes articulares, marcha e exercícios"), TEXT("Mouvement : amplitudes articulaires, marche et exercices"), TEXT("Bewegung: Gelenkbereiche, Gang und Übungen")}},
		{TEXT("Estudiar: lecciones, recorridos, glosario y preguntas"), {TEXT("Study: lessons, tours, glossary and questions"), TEXT("Estudar: lições, percursos, glossário e perguntas"), TEXT("Étudier : leçons, parcours, glossaire et questions"), TEXT("Lernen: Lektionen, Rundgänge, Glossar und Fragen")}},
		{TEXT("Este cuerpo no tiene movimiento"), {TEXT("This body has no movement"), TEXT("Este corpo não tem movimento"), TEXT("Ce corps n'a pas de mouvement"), TEXT("Dieser Körper hat keine Bewegung")}},
		{TEXT("Idioma"), {TEXT("Language"), TEXT("Idioma"), TEXT("Langue"), TEXT("Sprache")}},
		{TEXT("Ajustes"), {TEXT("Settings"), TEXT("Configurações"), TEXT("Réglages"), TEXT("Einstellungen")}},
		{TEXT("Plegar el panel"), {TEXT("Collapse the panel"), TEXT("Recolher o painel"), TEXT("Replier le panneau"), TEXT("Bereich einklappen")}},
		{TEXT("Abrir el panel de capas"), {TEXT("Open the layers panel"), TEXT("Abrir o painel de camadas"), TEXT("Ouvrir le panneau des couches"), TEXT("Ebenenbereich öffnen")}},
		{TEXT("Capas"), {TEXT("Layers"), TEXT("Camadas"), TEXT("Couches"), TEXT("Ebenen")}},
		{TEXT("capas a la vista"), {TEXT("layers shown"), TEXT("camadas visíveis"), TEXT("couches affichées"), TEXT("Ebenen sichtbar")}},
		{TEXT("Opacidad"), {TEXT("Opacity"), TEXT("Opacidade"), TEXT("Opacité"), TEXT("Deckkraft")}},
		{TEXT("Aislar"), {TEXT("Isolate"), TEXT("Isolar"), TEXT("Isoler"), TEXT("Isolieren")}},
		{TEXT("Ocultar"), {TEXT("Hide"), TEXT("Ocultar"), TEXT("Masquer"), TEXT("Ausblenden")}},
		{TEXT("Aislar la estructura seleccionada (I)"), {TEXT("Isolate the selected structure (I)"), TEXT("Isolar a estrutura selecionada (I)"), TEXT("Isoler la structure sélectionnée (I)"), TEXT("Ausgewählte Struktur isolieren (I)")}},
		{TEXT("Ocultar la estructura seleccionada (H)"), {TEXT("Hide the selected structure (H)"), TEXT("Ocultar a estrutura selecionada (H)"), TEXT("Masquer la structure sélectionnée (H)"), TEXT("Ausgewählte Struktur ausblenden (H)")}},
		{TEXT("Selecciona una estructura en el modelo"), {TEXT("Select a structure on the model"), TEXT("Selecione uma estrutura no modelo"), TEXT("Sélectionnez une structure sur le modèle"), TEXT("Wählen Sie eine Struktur am Modell aus")}},
		{TEXT("Fantasma: todo translúcido menos la capa de la estructura seleccionada"), {TEXT("Ghost: everything translucent except the layer of the selected structure"), TEXT("Fantasma: tudo translúcido, exceto a camada da estrutura selecionada"), TEXT("Fantôme : tout est translucide sauf la couche de la structure sélectionnée"), TEXT("Geistermodus: alles durchscheinend außer der Ebene der ausgewählten Struktur")}},
		{TEXT("Pelar: quita la capa de músculos más superficial"), {TEXT("Peel: removes the most superficial muscle layer"), TEXT("Remover camada: retira a camada muscular mais superficial"), TEXT("Effeuiller : retire la couche musculaire la plus superficielle"), TEXT("Abtragen: entfernt die oberflächlichste Muskelschicht")}},
		{TEXT("Devuelve la última capa de músculos quitada"), {TEXT("Restores the last muscle layer removed"), TEXT("Devolve a última camada muscular retirada"), TEXT("Rétablit la dernière couche musculaire retirée"), TEXT("Stellt die zuletzt entfernte Muskelschicht wieder her")}},
		{TEXT("Capa de músculos más superficial a la vista"), {TEXT("Most superficial muscle layer shown"), TEXT("Camada muscular mais superficial visível"), TEXT("Couche musculaire la plus superficielle affichée"), TEXT("Oberflächlichste sichtbare Muskelschicht")}},
		{TEXT("Sagital"), {TEXT("Sagittal"), TEXT("Sagital"), TEXT("Sagittal"), TEXT("Sagittal")}},
		{TEXT("Corte sagital"), {TEXT("Sagittal section"), TEXT("Corte sagital"), TEXT("Coupe sagittale"), TEXT("Sagittalschnitt")}},
		{TEXT("Corte coronal"), {TEXT("Coronal section"), TEXT("Corte coronal"), TEXT("Coupe coronale"), TEXT("Koronalschnitt")}},
		{TEXT("Corte axial"), {TEXT("Axial section"), TEXT("Corte axial"), TEXT("Coupe axiale"), TEXT("Axialschnitt")}},
		{TEXT("Posición del corte"), {TEXT("Section position"), TEXT("Posição do corte"), TEXT("Position de la coupe"), TEXT("Schnittposition")}},
		{TEXT("Enseña la otra mitad"), {TEXT("Shows the other half"), TEXT("Mostra a outra metade"), TEXT("Affiche l'autre moitié"), TEXT("Zeigt die andere Hälfte")}},
		{TEXT("Restablecer"), {TEXT("Reset"), TEXT("Redefinir"), TEXT("Réinitialiser"), TEXT("Zurücksetzen")}},
		// niveles de pelado de la barra de disección (profundidad de los músculos)
		{TEXT("Superficiales"), {TEXT("Superficial"), TEXT("Superficiais"), TEXT("Superficiels"), TEXT("Oberflächlich")}},
		{TEXT("Intermedios"), {TEXT("Intermediate"), TEXT("Intermediários"), TEXT("Intermédiaires"), TEXT("Mittlere")}},
		{TEXT("Profundos"), {TEXT("Deep"), TEXT("Profundos"), TEXT("Profonds"), TEXT("Tiefe")}},
		{TEXT("Restablecer: muestra todo y quita el corte, el fantasma y el pelado"), {TEXT("Reset: shows everything and removes the section, ghost and peeling"), TEXT("Redefinir: mostra tudo e remove o corte, o fantasma e as camadas retiradas"), TEXT("Réinitialiser : tout afficher et retirer la coupe, le fantôme et l'effeuillage"), TEXT("Zurücksetzen: alles zeigen, Schnitt, Geistermodus und Abtragen aufheben")}},
		// cruceta de vistas: abreviatura en el botón, nombre completo y tecla en la ayuda
		{TEXT("Ant."), {TEXT("Ant."), TEXT("Ant."), TEXT("Ant."), TEXT("Vorn")}},
		{TEXT("Post."), {TEXT("Post."), TEXT("Post."), TEXT("Post."), TEXT("Hint.")}},
		{TEXT("Dcha."), {TEXT("R"), TEXT("Dir."), TEXT("D"), TEXT("Re.")}},
		{TEXT("Izda."), {TEXT("L"), TEXT("Esq."), TEXT("G"), TEXT("Li.")}},
		{TEXT("Sup."), {TEXT("Sup."), TEXT("Sup."), TEXT("Sup."), TEXT("Oben")}},
		{TEXT("Inf."), {TEXT("Inf."), TEXT("Inf."), TEXT("Inf."), TEXT("Unt.")}},
		{TEXT("Vista anterior (1)"), {TEXT("Anterior view (1)"), TEXT("Vista anterior (1)"), TEXT("Vue antérieure (1)"), TEXT("Ansicht von vorn (1)")}},
		{TEXT("Vista posterior (2)"), {TEXT("Posterior view (2)"), TEXT("Vista posterior (2)"), TEXT("Vue postérieure (2)"), TEXT("Ansicht von hinten (2)")}},
		{TEXT("Vista derecha (3)"), {TEXT("Right view (3)"), TEXT("Vista direita (3)"), TEXT("Vue de droite (3)"), TEXT("Ansicht von rechts (3)")}},
		{TEXT("Vista izquierda (4)"), {TEXT("Left view (4)"), TEXT("Vista esquerda (4)"), TEXT("Vue de gauche (4)"), TEXT("Ansicht von links (4)")}},
		{TEXT("Vista superior (5)"), {TEXT("Superior view (5)"), TEXT("Vista superior (5)"), TEXT("Vue supérieure (5)"), TEXT("Ansicht von oben (5)")}},
		{TEXT("Vista inferior (6)"), {TEXT("Inferior view (6)"), TEXT("Vista inferior (6)"), TEXT("Vue inférieure (6)"), TEXT("Ansicht von unten (6)")}},
		// ── Interfaz, fase 3: ficha en bloques, enlaces a Estudiar, examen y visión de color ──
		// (las plantillas llevan {0} y {1} donde van las cifras: cada idioma las pone en su sitio)
		{TEXT("Anatomía"), {TEXT("Anatomy"), TEXT("Anatomia"), TEXT("Anatomie"), TEXT("Anatomie")}},
		{TEXT("Función"), {TEXT("Function"), TEXT("Função"), TEXT("Fonction"), TEXT("Funktion")}},
		{TEXT("Relevancia clínica"), {TEXT("Clinical relevance"), TEXT("Relevância clínica"), TEXT("Intérêt clinique"), TEXT("Klinische Relevanz")}},
		{TEXT("Función biomecánica (plano / eje)"), {TEXT("Biomechanical function (plane / axis)"), TEXT("Função biomecânica (plano / eixo)"), TEXT("Fonction biomécanique (plan / axe)"), TEXT("Biomechanische Funktion (Ebene / Achse)")}},
		{TEXT("Prueba muscular manual"), {TEXT("Manual muscle testing"), TEXT("Teste muscular manual"), TEXT("Testing musculaire manuel"), TEXT("Manueller Muskeltest")}},
		{TEXT("Articula con"), {TEXT("Articulates with"), TEXT("Articula-se com"), TEXT("S'articule avec"), TEXT("Artikuliert mit")}},
		// el rótulo largo («Puntos de referencia (palpación e imagen)») no cabía en la columna de rótulos de la ficha
		{TEXT("Palpación e imagen"), {TEXT("Palpation and imaging"), TEXT("Palpação e imagem"), TEXT("Palpation et imagerie"), TEXT("Palpation und Bildgebung")}},
		// rótulos por tipo de la ficha de vasos y nervios: en la web, en y pt van en TL() dentro de renderInfo; fr y de, en i18n_fr/de.json
		{TEXT("Se forma"), {TEXT("Formed by"), TEXT("Forma-se"), TEXT("Formé par"), TEXT("Gebildet durch")}},
		{TEXT("Tributarias"), {TEXT("Tributaries"), TEXT("Tributárias"), TEXT("Affluents"), TEXT("Zuflüsse")}},
		{TEXT("Drena"), {TEXT("Drains"), TEXT("Drena"), TEXT("Draine"), TEXT("Drainiert")}},
		{TEXT("Irriga"), {TEXT("Supplies"), TEXT("Irriga"), TEXT("Irrigue"), TEXT("Versorgt")}},
		{TEXT("Termina"), {TEXT("Ends"), TEXT("Termina"), TEXT("Se termine"), TEXT("Endet")}},
		{TEXT("Inerva"), {TEXT("Supplies"), TEXT("Inerva"), TEXT("Innerve"), TEXT("Innerviert")}},
		{TEXT("Ver los {0}"), {TEXT("Show all {0}"), TEXT("Ver os {0}"), TEXT("Voir les {0}"), TEXT("Alle {0} anzeigen")}},
		{TEXT("Ver menos"), {TEXT("Show fewer"), TEXT("Ver menos"), TEXT("Voir moins"), TEXT("Weniger anzeigen")}},
		{TEXT("Pregunta {0} de {1}"), {TEXT("Question {0} of {1}"), TEXT("Pergunta {0} de {1}"), TEXT("Question {0} sur {1}"), TEXT("Frage {0} von {1}")}},
		{TEXT("Ver resultado"), {TEXT("See result"), TEXT("Ver resultado"), TEXT("Voir le résultat"), TEXT("Ergebnis anzeigen")}},
		{TEXT("Resultado"), {TEXT("Result"), TEXT("Resultado"), TEXT("Résultat"), TEXT("Ergebnis")}},
		{TEXT("Repetir"), {TEXT("Try again"), TEXT("Repetir"), TEXT("Recommencer"), TEXT("Wiederholen")}},
		{TEXT("Sin responder"), {TEXT("Unanswered"), TEXT("Sem resposta"), TEXT("Sans réponse"), TEXT("Unbeantwortet")}},
		{TEXT("Faltan los datos de estudio: node tools/unreal/estudio.js"), {TEXT("Study data missing: node tools/unreal/estudio.js"), TEXT("Faltam os dados de estudo: node tools/unreal/estudio.js"), TEXT("Données d'étude manquantes : node tools/unreal/estudio.js"), TEXT("Lerndaten fehlen: node tools/unreal/estudio.js")}},
		{TEXT("Actividad muscular: amarillo (poca) → magenta (mucha). Datos de laboratorio: Fukuchi 2018, Schreiber 2019, Lencioni 2019."), {TEXT("Muscle activity: yellow (low) → magenta (high). Laboratory data: Fukuchi 2018, Schreiber 2019, Lencioni 2019."), TEXT("Atividade muscular: amarelo (pouca) → magenta (muita). Dados de laboratório: Fukuchi 2018, Schreiber 2019, Lencioni 2019."), TEXT("Activité musculaire : jaune (faible) → magenta (forte). Données de laboratoire : Fukuchi 2018, Schreiber 2019, Lencioni 2019."), TEXT("Muskelaktivität: gelb (gering) → magenta (hoch). Labordaten: Fukuchi 2018, Schreiber 2019, Lencioni 2019.")}},
		{TEXT("Visión de color"), {TEXT("Colour vision"), TEXT("Visão de cores"), TEXT("Vision des couleurs"), TEXT("Farbsehen")}},
		{TEXT("Normal"), {TEXT("Normal"), TEXT("Normal"), TEXT("Normale"), TEXT("Normal")}},
		{TEXT("Deuteranopía"), {TEXT("Deuteranopia"), TEXT("Deuteranopia"), TEXT("Deutéranopie"), TEXT("Deuteranopie")}},
		{TEXT("Protanopía"), {TEXT("Protanopia"), TEXT("Protanopia"), TEXT("Protanopie"), TEXT("Protanopie")}},
		{TEXT("Tritanopía"), {TEXT("Tritanopia"), TEXT("Tritanopia"), TEXT("Tritanopie"), TEXT("Tritanopie")}},
		{TEXT("Filtro de color del motor para deuteranopía, protanopía o tritanopía. Ajusta la imagen de la ventana; no cambia los colores de las capas en los datos."),
			{TEXT("Engine colour filter for deuteranopia, protanopia or tritanopia. It adjusts the window image; it does not change the layer colours in the data."),
			 TEXT("Filtro de cor do motor para deuteranopia, protanopia ou tritanopia. Ajusta a imagem da janela; não altera as cores das camadas nos dados."),
			 TEXT("Filtre de couleur du moteur pour la deutéranopie, la protanopie ou la tritanopie. Il ajuste l'image de la fenêtre ; il ne modifie pas les couleurs des couches dans les données."),
			 TEXT("Farbfilter der Engine für Deuteranopie, Protanopie oder Tritanopie. Er passt das Fensterbild an; die Farben der Ebenen in den Daten bleiben unverändert.")}},
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
			if (J->TryGetObjectField(TEXT("ui"), UiJ) && (*UiJ)->TryGetObjectField(Codigo, O)) { UiAprox.Add(Codigo, *O); }
			if (!LeerParesExactos(TEXT("i18n.json"), { TEXT("ui"), Codigo }, Ui, true) && O) { Volcar(*O, Ui, true); }
			if (Codigo == TEXT("pt")) { LeerParesExactos(TEXT("i18n.json"), { TEXT("names") }, Nombres, true); }
		}
	}
	else if (const TSharedPtr<FJsonObject> J = LeerObjeto(FString::Printf(TEXT("i18n_%s.json"), *Codigo)))
	{
		// Las claves se leen distinguiendo mayúsculas («Cadera» → Hanche, «cadera» → cadera): el FJsonObject de Unreal
		// las funde en una sola y dejaba en francés y alemán nombres de articulación equivocados en los botones.
		const FString Arch = FString::Printf(TEXT("i18n_%s.json"), *Codigo);
		if (J->TryGetObjectField(TEXT("ui"), O)) { UiAprox.Add(Codigo, *O); }
		if (!LeerParesExactos(Arch, { TEXT("ui") }, Ui, true) && O) { Volcar(*O, Ui, true); }
		LeerParesExactos(Arch, { TEXT("names") }, Nombres, true);
		// content_fr/de: textos largos (español → traducción); no pisan la interfaz
		LeerParesExactos(FString::Printf(TEXT("content_%s.json"), *Codigo), {}, Ui, false);
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
	const FString& En = P->EnPropio.IsEmpty() ? P->En : P->EnPropio;
	if (IdiomaActual == TEXT("en")) { return En; }
	if (const FTablaTr* N = NombresTr.Find(IdiomaActual)) { if (const FString* S = N->Find(P->Es)) { return *S; } }
	return IdiomaActual == TEXT("pt") ? P->Es : En;
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
	for (const FCorpusCampoFicha& C : FichaCampos(Id)) { Fuera.Emplace(C.Etiqueta, C.Texto); }
	return Fuera;
}

TArray<FCorpusCampoFicha> UCorpusDatos::FichaCampos(const FString& Id)
{
	TArray<FCorpusCampoFicha> Fuera;
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
	// el tipo en español (antes de cambiar de idioma) decide los rótulos de vasos, nervios y vías, como renderInfo en la web
	FString TipoEs;
	F->TryGetStringField(TEXT("tipo"), TipoEs);
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
		{TEXT("territorio"), TEXT("Territorio")}, {TEXT("relaciones"), TEXT("Relaciones")},
		// mismos rótulos que la ficha de la web (renderInfo en index.html); antes «biomecanica» salía como «BIOMECANICA», sin tilde
		{TEXT("clinica"), TEXT("Relevancia clínica")}, {TEXT("biomecanica"), TEXT("Función biomecánica (plano / eje)")},
		{TEXT("prueba"), TEXT("Prueba muscular manual")}, {TEXT("articula"), TEXT("Articula con")},
		// en los huesos no es bibliografía: son puntos de palpación y de imagen (revisión del director clínico, 2026-11-22)
		{TEXT("referencias"), TEXT("Palpación e imagen")}
	};
	// estructuras del grupo «rest» (vasos, nervios, linfáticos, vías): rótulos de origen, destino, ramas y territorio según
	// el tipo, igual que index.html (renderInfo). Una vena recibe tributarias y drena; una arteria da ramas e irriga.
	TMap<FString, FString> PorTipo;
	if (Tipo == TEXT("rest"))
	{
		FString t = TipoEs.ToLower();
		static const TCHAR* Con[] = { TEXT("á"), TEXT("é"), TEXT("í"), TEXT("ó"), TEXT("ú") };
		static const TCHAR* Sin[] = { TEXT("a"), TEXT("e"), TEXT("i"), TEXT("o"), TEXT("u") };
		for (int32 i = 0; i < 5; ++i) { t.ReplaceInline(Con[i], Sin[i]); }
		const auto Hay = [&t](std::initializer_list<const TCHAR*> L) { for (const TCHAR* S : L) { if (t.Contains(S)) { return true; } } return false; };
		const TCHAR* L[4];
		const auto Poner = [&L](const TCHAR* A, const TCHAR* B, const TCHAR* C, const TCHAR* D) { L[0] = A; L[1] = B; L[2] = C; L[3] = D; };
		if (Hay({ TEXT("vena"), TEXT("seno"), TEXT("venos") })) { Poner(TEXT("Se forma"), TEXT("Desemboca en"), TEXT("Tributarias"), TEXT("Drena")); }
		else if (Hay({ TEXT("arteria"), TEXT("arterial") })) { Poner(TEXT("Nace de"), TEXT("Continúa como"), TEXT("Ramas"), TEXT("Irriga")); }
		else if (Hay({ TEXT("nervio"), TEXT("ramo"), TEXT("plexo"), TEXT("tronco"), TEXT("division"), TEXT("fasciculo") })
			|| (t.Contains(TEXT("ganglio")) && !t.Contains(TEXT("ganglio linf")))) { Poner(TEXT("Origen"), TEXT("Termina"), TEXT("Ramas"), TEXT("Inerva")); }
		else if (t.Contains(TEXT("linf"))) { Poner(TEXT("Origen"), TEXT("Drenaje eferente"), TEXT("Ramas"), TEXT("Región que drena")); }
		else if (Hay({ TEXT("tracto"), TEXT("via"), TEXT("fascicul") })) { Poner(TEXT("Origen"), TEXT("Destino"), TEXT("Ramas"), TEXT("Irrigación")); }
		else { Poner(TEXT("Inserción proximal"), TEXT("Inserción distal"), TEXT("Ramas"), TEXT("Relación / irrigación")); }
		PorTipo.Add(TEXT("origen"), L[0]); PorTipo.Add(TEXT("destino"), L[1]); PorTipo.Add(TEXT("ramas"), L[2]); PorTipo.Add(TEXT("territorio"), L[3]);
	}
	for (const auto& Campo : F->Values)
	{
		const FString K(Campo.Key);
		FString Texto;
		if (K == TEXT("es") || K == TEXT("la") || !Campo.Value.IsValid() || !Campo.Value->TryGetString(Texto) || Texto.IsEmpty()) { continue; }
		const FString* Et = PorTipo.Find(K);
		if (!Et) { Et = Etiquetas.Find(K); }
		Fuera.Add(FCorpusCampoFicha{ K, T(Et ? *Et : K.Left(1).ToUpper() + K.Mid(1)), Texto });
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

// ───────── Módulos de estudio (estudio_<idioma>.json y estudio_vistas.json, de tools/unreal/estudio.js) ─────────
namespace
{
	TArray<FString> ListaCad(const TSharedPtr<FJsonObject>& O, const TCHAR* Campo)
	{
		TArray<FString> R;
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (O.IsValid() && O->TryGetArrayField(Campo, A)) { for (const auto& V : *A) { FString S; if (V.IsValid() && V->TryGetString(S)) { R.Add(S); } } }
		return R;
	}
	FString CampoCad(const TSharedPtr<FJsonObject>& O, const TCHAR* Campo) { FString S; if (O.IsValid()) { O->TryGetStringField(Campo, S); } return S; }
	int32 CampoEnt(const TSharedPtr<FJsonObject>& O, const TCHAR* Campo, int32 Def) { double N = Def; if (O.IsValid()) { O->TryGetNumberField(Campo, N); } return (int32)N; }
}

const FCorpusEstudio& UCorpusDatos::Estudio()
{
	if (const FCorpusEstudio* Ya = EstudioPorIdioma.Find(IdiomaActual)) { return *Ya; }
	FCorpusEstudio E;
	if (const TSharedPtr<FJsonObject> J = LeerObjeto(FString::Printf(TEXT("estudio_%s.json"), *IdiomaActual)))
	{
		J->TryGetStringField(TEXT("aviso"), E.Aviso);
		const TSharedPtr<FJsonObject>* Ui = nullptr;
		if (J->TryGetObjectField(TEXT("ui"), Ui)) { for (const auto& Par : (*Ui)->Values) { FString S; if (Par.Value.IsValid() && Par.Value->TryGetString(S)) { E.Ui.Add(FString(Par.Key), S); } } }
		const TArray<TSharedPtr<FJsonValue>>* Mods = nullptr;
		if (J->TryGetArrayField(TEXT("modulos"), Mods))
		{
			for (const auto& VM : *Mods)
			{
				const TSharedPtr<FJsonObject>* OM = nullptr;
				if (!VM.IsValid() || !VM->TryGetObject(OM)) { continue; }
				FCorpusModuloEstudio M; M.Id = CampoCad(*OM, TEXT("id")); M.N = CampoCad(*OM, TEXT("n"));
				const TArray<TSharedPtr<FJsonValue>>* Grs = nullptr;
				if ((*OM)->TryGetArrayField(TEXT("grupos"), Grs))
				{
					for (const auto& VG : *Grs)
					{
						const TSharedPtr<FJsonObject>* OG = nullptr;
						if (!VG.IsValid() || !VG->TryGetObject(OG)) { continue; }
						FCorpusGrupoEstudio G; G.N = CampoCad(*OG, TEXT("n"));
						const TArray<TSharedPtr<FJsonValue>>* Its = nullptr;
						if ((*OG)->TryGetArrayField(TEXT("items"), Its))
						{
							G.Items.Reserve(Its->Num());
							for (const auto& VI : *Its)
							{
								const TSharedPtr<FJsonObject>* OI = nullptr;
								if (!VI.IsValid() || !VI->TryGetObject(OI)) { continue; }
								FCorpusItemEstudio& I = G.Items.AddDefaulted_GetRef();
								I.Id = CampoCad(*OI, TEXT("id")); I.T = CampoCad(*OI, TEXT("t")); I.Sub = CampoCad(*OI, TEXT("sub"));
								I.Img = CampoCad(*OI, TEXT("img")); I.Cred = CampoCad(*OI, TEXT("cred")); I.Lado = CampoCad(*OI, TEXT("lado"));
								I.Show = ListaCad(*OI, TEXT("show")); I.Capas = ListaCad(*OI, TEXT("capas")); I.Vista = CampoEnt(*OI, TEXT("view"), -1);
								const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
								if ((*OI)->TryGetArrayField(TEXT("secs"), A))
								{
									for (const auto& VS : *A) { const TArray<TSharedPtr<FJsonValue>>* Par = nullptr; if (VS.IsValid() && VS->TryGetArray(Par) && Par->Num() == 2) { I.Secs.Emplace(Cad(*Par, 0), Cad(*Par, 1)); } }
								}
								if ((*OI)->TryGetArrayField(TEXT("pasos"), A))
								{
									for (const auto& VP : *A)
									{
										const TSharedPtr<FJsonObject>* OP = nullptr;
										if (!VP.IsValid() || !VP->TryGetObject(OP)) { continue; }
										FCorpusPasoEstudio& P = I.Pasos.AddDefaulted_GetRef();
										P.T = CampoCad(*OP, TEXT("t")); P.X = CampoCad(*OP, TEXT("x")); P.Ver = CampoCad(*OP, TEXT("ver"));
										P.Show = ListaCad(*OP, TEXT("show")); P.Vista = CampoEnt(*OP, TEXT("view"), -1);
									}
								}
								if ((*OI)->TryGetArrayField(TEXT("q"), A))
								{
									for (const auto& VQ : *A)
									{
										const TSharedPtr<FJsonObject>* OQ = nullptr;
										if (!VQ.IsValid() || !VQ->TryGetObject(OQ)) { continue; }
										FCorpusPregunta& Q = I.Q.AddDefaulted_GetRef();
										Q.P = CampoCad(*OQ, TEXT("p")); Q.X = CampoCad(*OQ, TEXT("x")); Q.O = ListaCad(*OQ, TEXT("o")); Q.A = CampoEnt(*OQ, TEXT("a"), 0);
									}
								}
							}
						}
						M.Grupos.Add(MoveTemp(G));
					}
				}
				E.Modulos.Add(MoveTemp(M));
			}
		}
	}
	return EstudioPorIdioma.Add(IdiomaActual, MoveTemp(E));
}

FString UCorpusDatos::TE(const FString& Clave)
{
	const FString* S = Estudio().Ui.Find(Clave);
	return S ? *S : Clave;
}

const FCorpusVistaPaso* UCorpusDatos::VistaDePaso(const FString& Clave)
{
	if (!bVistasLeidas)
	{
		bVistasLeidas = true;
		if (const TSharedPtr<FJsonObject> J = LeerObjeto(TEXT("estudio_vistas.json")))
		{
			for (const auto& Par : J->Values)
			{
				const TSharedPtr<FJsonObject>* O = nullptr;
				if (!Par.Value.IsValid() || !Par.Value->TryGetObject(O)) { continue; }
				FCorpusVistaPaso V;
				const TSharedPtr<FJsonObject>* Capas = nullptr;
				if ((*O)->TryGetObjectField(TEXT("capas"), Capas)) { for (const auto& C : (*Capas)->Values) { double Op = 1; if (C.Value.IsValid() && C.Value->TryGetNumber(Op)) { V.Capas.Add(FString(C.Key), (float)Op); } } }
				const TArray<TSharedPtr<FJsonValue>>* Iso = nullptr;
				V.bIso = (*O)->TryGetArrayField(TEXT("iso"), Iso);
				V.Iso = ListaCad(*O, TEXT("iso")); V.Ocultas = ListaCad(*O, TEXT("ocultas"));
				V.bMujer = CampoCad(*O, TEXT("cuerpo")) == TEXT("f");
				const TSharedPtr<FJsonObject>* Cam = nullptr;
				if ((*O)->TryGetObjectField(TEXT("cam"), Cam))
				{
					double N = 0;
					if ((*Cam)->TryGetNumberField(TEXT("th"), N)) { V.Th = (float)N; }
					if ((*Cam)->TryGetNumberField(TEXT("ph"), N)) { V.Ph = (float)N; }
					if ((*Cam)->TryGetNumberField(TEXT("r"), N)) { V.R = (float)N; }
					const TArray<TSharedPtr<FJsonValue>>* T3 = nullptr;
					if ((*Cam)->TryGetArrayField(TEXT("tgt"), T3) && T3->Num() == 3) { V.Tgt = FVector3f((float)(*T3)[0]->AsNumber(), (float)(*T3)[1]->AsNumber(), (float)(*T3)[2]->AsNumber()); }
				}
				VistasPaso.Add(FString(Par.Key), MoveTemp(V));
			}
		}
	}
	return VistasPaso.Find(Clave);
}