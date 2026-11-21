#include "CorpusCuerpo.h"
#include "CorpusDatos.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/GameInstance.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialParameterCollection.h"
#include "Materials/MaterialParameterCollectionInstance.h"
#include "Engine/World.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"

namespace
{
	const TCHAR* RUTA_MALLAS = TEXT("/Game/Corpus/Mallas");
	const TCHAR* RUTA_MATERIALES = TEXT("/Game/Corpus/Materiales");
	const FLinearColor COLOR_SELECCION(0.10f, 0.55f, 1.0f); // azul de selección de la web
	const FLinearColor COLOR_AGONISTA = FLinearColor(FColor::FromHex(TEXT("f0a040")));   // agonistas del rango articular (web: estado «ag»)
	// Con la postura puesta, cada pieza puede alejarse hasta ~1,5 m de su sitio (el brazo entero): sus límites se agrandan
	// para que no se recorte al salir de la caja de reposo.
	const float ALCANCE_POSTURA = 160.f;
}

ACorpusCuerpo::ACorpusCuerpo()
{
	PrimaryActorTick.bCanEverTick = true;
	Raiz = CreateDefaultSubobject<USceneComponent>(TEXT("Raiz"));
	SetRootComponent(Raiz);
}

UCorpusDatos* ACorpusCuerpo::Datos() const
{
	const UGameInstance* GI = GetGameInstance();
	return GI ? GI->GetSubsystem<UCorpusDatos>() : nullptr;
}

FString ACorpusCuerpo::CarpetaCuerpo() const
{
	return CuerpoActual == ECorpusCuerpo::Mujer ? TEXT("mujer") : CuerpoActual == ECorpusCuerpo::VisibleHuman ? TEXT("vh") : TEXT("hombre");
}

void ACorpusCuerpo::BeginPlay()
{
	Super::BeginPlay();
	TransformBase = Raiz ? Raiz->GetRelativeTransform() : FTransform::Identity;
	if (const UCorpusDatos* D = Datos())
	{
		for (const FCorpusCapa& C : D->Capas())
		{
			Opacidades.Add(C.Clave, C.Opacidad);
			if (C.bActivaAlInicio && CapaDisponible(C.Clave)) { MostrarCapa(C.Clave, true); }
		}
	}
}

bool ACorpusCuerpo::CapaDisponible(const FString& Clave) const
{
	const UCorpusDatos* D = Datos();
	const FCorpusCapa* C = D ? D->Capa(Clave) : nullptr;
	if (!C) { return false; }
	switch (CuerpoActual)
	{
	case ECorpusCuerpo::VisibleHuman: return C->Sexo == TEXT("vh");
	case ECorpusCuerpo::Mujer: return C->Sexo.IsEmpty() || C->Sexo == TEXT("f");
	default: return C->Sexo.IsEmpty() || C->Sexo == TEXT("m");
	}
}

UMaterialInterface* ACorpusCuerpo::MaterialDe(const FString& Base, bool bTranslucido)
{
	const FString Nombre = FString::Printf(TEXT("MI_%s%s"), *Base, bTranslucido ? TEXT("_T") : TEXT(""));
	if (const TObjectPtr<UMaterialInterface>* M = Materiales.Find(Nombre)) { return *M; }
	UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("%s/%s.%s"), RUTA_MATERIALES, *Nombre, *Nombre));
	if (!Mat)
	{
		const TCHAR* Maestro = bTranslucido ? TEXT("M_CorpusTranslucido") : TEXT("M_CorpusTejido");
		Mat = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("%s/%s.%s"), RUTA_MATERIALES, Maestro, Maestro));
	}
	// Instancia dinámica: el material lee la postura (giros de cada articulación) de una textura que se actualiza al moverse
	if (Mat)
	{
		CrearTexturaPostura();
		CrearTexturaCorrectivo();
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Mat, this);
		MID->SetTextureParameterValue(TEXT("Postura"), TexPostura);
		MID->SetTextureParameterValue(TEXT("Correctivo"), TexCorrectivo);
		Mat = MID;
	}
	Materiales.Add(Nombre, Mat);
	return Mat;
}

// ───────── Movimiento ─────────

void ACorpusCuerpo::CrearTexturaPostura()
{
	if (TexPostura) { return; }
	const UCorpusDatos* D = Datos();
	const int32 N = D ? D->PivotesArticulaciones().Num() : 0;
	AltoPostura = 4 + (D ? D->ContornoTorax().Num() : 0);
	AnchoPostura = FMath::Max3(32, N, (D && D->ContornoTorax().Num()) ? D->ContornoTorax()[0].Num() : 0);
	TexPostura = UTexture2D::CreateTransient(AnchoPostura, AltoPostura, PF_A32B32G32R32F, TEXT("T_Postura"));
	TexPostura->Filter = TF_Nearest;
	TexPostura->SRGB = false;
	TexPostura->AddressX = TA_Clamp; TexPostura->AddressY = TA_Clamp;
	TexPostura->NeverStream = true;
	TexPostura->UpdateResource();
	// Fila 0: eje y ángulo · fila 1: pivote · fila 2: traslación (todo en glTF, metros, como la web)
	Postura.Init(FVector4f(0, 0, 0, 0), AnchoPostura * AltoPostura);
	for (int32 i = 0; i < N; ++i)
	{
		const FVector3f& P = D->PivotesArticulaciones()[i];
		Postura[AnchoPostura + i] = FVector4f(P.X, P.Y, P.Z, 0.f);
	}
	// Filas 4…: contorno real de la parrilla costal (altura × sector angular); el material mide con él la distancia a las costillas
	for (int32 h = 0; D && h < D->ContornoTorax().Num(); ++h)
	{
		const TArray<float>& F = D->ContornoTorax()[h];
		for (int32 s = 0; s < FMath::Min(AnchoPostura, F.Num()); ++s) { Postura[AnchoPostura * (4 + h) + s] = FVector4f(F[s], 0.f, 0.f, 0.f); }
	}
	SubirPostura();
}

void ACorpusCuerpo::SubirPostura()
{
	if (!TexPostura) { return; }
	const int32 Paso = AnchoPostura * sizeof(FVector4f);
	uint8* Copia = (uint8*)FMemory::Malloc(Paso * AltoPostura);
	FMemory::Memcpy(Copia, Postura.GetData(), Paso * AltoPostura);
	FUpdateTextureRegion2D* Region = new FUpdateTextureRegion2D(0, 0, 0, 0, AnchoPostura, AltoPostura);
	TexPostura->UpdateTextureRegions(0, 1, Region, Paso, sizeof(FVector4f), Copia,
		[](uint8* Datos, const FUpdateTextureRegion2D* R) { FMemory::Free(Datos); delete R; });
}

// ───────── Correctivos elásticos del hombro (tools/unreal/correctivos.js) ─────────

void ACorpusCuerpo::CrearTexturaCorrectivo()
{
	if (TexCorrectivo) { return; }
	const UCorpusDatos* D = Datos();
	const int32 Texeles = D ? D->TexelesCorrectivo() : 0;
	AnchoCorr = Texeles > 0 ? D->AnchoCorrectivo() : 4;
	FilasCorr = FMath::Max(1, FMath::DivideAndRoundUp(FMath::Max(Texeles, 1), AnchoCorr));
	TexCorrectivo = UTexture2D::CreateTransient(AnchoCorr, FilasCorr * 2, PF_A32B32G32R32F, TEXT("T_Correctivo"));
	TexCorrectivo->Filter = TF_Nearest;
	TexCorrectivo->SRGB = false;
	TexCorrectivo->AddressX = TA_Clamp; TexCorrectivo->AddressY = TA_Clamp;
	TexCorrectivo->NeverStream = true;
	TexCorrectivo->UpdateResource();
	Correctivo.Init(FVector4f(0, 0, 0, 0), AnchoCorr * FilasCorr * 2);
	for (int32 i = AnchoCorr * FilasCorr; i < Correctivo.Num(); ++i) { Correctivo[i] = FVector4f(0, 0, 0, 1); }
	Correctivo[0] = FVector4f(0.f, (float)FilasCorr, 0.f, 0.f);
	SubirCorrectivo();
}

void ACorpusCuerpo::SubirCorrectivo()
{
	if (!TexCorrectivo) { return; }
	const int32 Paso = AnchoCorr * sizeof(FVector4f), Alto = FilasCorr * 2;
	uint8* Copia = (uint8*)FMemory::Malloc(Paso * Alto);
	FMemory::Memcpy(Copia, Correctivo.GetData(), Paso * Alto);
	FUpdateTextureRegion2D* Region = new FUpdateTextureRegion2D(0, 0, 0, 0, AnchoCorr, Alto);
	TexCorrectivo->UpdateTextureRegions(0, 1, Region, Paso, sizeof(FVector4f), Copia,
		[](uint8* Datos, const FUpdateTextureRegion2D* R) { FMemory::Free(Datos); delete R; });
}

void ACorpusCuerpo::PonerCorrectivo(const FCorpusRango* R, int32 Mov, bool bIzq, int32 I0, int32 I1, float A)
{
	const UCorpusDatos* D = Datos();
	CrearTexturaCorrectivo();
	const FCorpusCorrMov* CM = (D && R) ? D->Correctivo(R->Id, Mov, bIzq) : nullptr;
	if (!CM || CM->Cuadros < 1)
	{
		// este movimiento no lleva correctivos: los músculos vuelven a moverse solo con sus pesos
		if (bCorrActivo) { bCorrActivo = false; ClaveCorr.Reset(); Correctivo[0].X = 0.f; SubirCorrectivo(); }
		return;
	}
	const FString Clave = FString::Printf(TEXT("%s/%d/%d"), *R->Id, Mov, bIzq ? 1 : 0);
	const int32 Mitad = AnchoCorr * FilasCorr;
	if (Clave != ClaveCorr)
	{
		// otro movimiento u otro lado: todo a reposo (el lado que no se mueve se queda así)
		for (int32 i = 1; i < Mitad; ++i) { Correctivo[i] = FVector4f(0, 0, 0, 0); }
		for (int32 i = Mitad; i < Correctivo.Num(); ++i) { Correctivo[i] = FVector4f(0, 0, 0, 1); }
		ClaveCorr = Clave;
	}
	I0 = FMath::Clamp(I0, 0, CM->Cuadros - 1); I1 = FMath::Clamp(I1, 0, CM->Cuadros - 1);
	const uint8* Bin = D->BinCorrectivos().GetData();
	const float Esc = 1.f / D->EscalaCorrectivo(), EscQ = 1.f / 32767.f;
	for (const auto& Par : CM->Piezas)
	{
		const FCorpusRejilla* Rj = D->RejillaDe(Par.Key);
		if (!Rj) { continue; }
		const uint32* Lista = (const uint32*)(Bin + Rj->Lista);
		const int16* F0 = (const int16*)(Bin + Par.Value) + (int64)I0 * Rj->Act * 7;
		const int16* F1 = (const int16*)(Bin + Par.Value) + (int64)I1 * Rj->Act * 7;
		for (int32 i = 0; i < Rj->Act; ++i)
		{
			const int32 T = Rj->Base + (int32)Lista[i];
			if (T < 1 || T >= Mitad) { continue; }
			const int16* a = F0 + i * 7; const int16* b = F1 + i * 7;
			Correctivo[T] = FVector4f(FMath::Lerp((float)a[0], (float)b[0], A) * Esc, FMath::Lerp((float)a[1], (float)b[1], A) * Esc, FMath::Lerp((float)a[2], (float)b[2], A) * Esc, 0.f);
			// los giros vienen con el mismo signo de un cuadro al siguiente: se pueden mezclar tal cual (el material normaliza)
			Correctivo[Mitad + T] = FVector4f(FMath::Lerp((float)a[3], (float)b[3], A) * EscQ, FMath::Lerp((float)a[4], (float)b[4], A) * EscQ, FMath::Lerp((float)a[5], (float)b[5], A) * EscQ, FMath::Lerp((float)a[6], (float)b[6], A) * EscQ);
		}
	}
	Correctivo[0] = FVector4f(1.f, (float)FilasCorr, 0.f, 0.f);
	bCorrActivo = true;
	SubirCorrectivo();
}

bool ACorpusCuerpo::MovimientoDisponible() const
{
	const UCorpusDatos* D = Datos();
	return D && D->Rangos().Num() > 0 && CuerpoActual != ECorpusCuerpo::VisibleHuman;
}

float ACorpusCuerpo::GradosMax() const
{
	const UCorpusDatos* D = Datos();
	if (!D || !D->Rangos().IsValidIndex(RangoActual) || !D->Rangos()[RangoActual].Movs.IsValidIndex(MovActual)) { return 0.f; }
	return D->Rangos()[RangoActual].Movs[MovActual].Max;
}

void ACorpusCuerpo::AjustarLimites(UStaticMeshComponent* C) const
{
	// la postura saca la malla de su caja de reposo: sin agrandar los límites, Nanite y las sombras la recortarían
	const float Radio = FMath::Max(C->Bounds.SphereRadius / FMath::Max(C->BoundsScale, 1e-3f), 0.5f);
	C->SetBoundsScale(HayPostura() ? FMath::Clamp((Radio + ALCANCE_POSTURA) / Radio, 1.f, 400.f) : 1.f);
}

void ACorpusCuerpo::PintarAgonistas(const TArray<FString>& En, const FString& Lado)
{
	const UCorpusDatos* D = Datos();
	for (const FString& Id : IdsAgonistas) { if (Id != IdSeleccionada) { PonerEstado(Id, FLinearColor::Black, 0.f); } }
	IdsAgonistas.Reset();
	if (!D || En.Num() == 0) { return; }
	const TSet<FString> Nombres(En);
	for (const auto& Par : Piezas)
	{
		const FCorpusPieza* P = D->Pieza(Par.Key);
		if (!P || !Nombres.Contains(P->En)) { continue; }
		if (!Lado.IsEmpty() && !P->Lado.IsEmpty() && !P->Lado.StartsWith(Lado)) { continue; }
		IdsAgonistas.Add(Par.Key);
		if (Par.Key != IdSeleccionada) { PonerEstado(Par.Key, COLOR_AGONISTA, 0.75f); }
	}
}

void ACorpusCuerpo::PosturaEnReposo()
{
	// ángulos y traslaciones a cero (los pivotes y el contorno del tórax no cambian)
	for (int32 i = 0; i < AnchoPostura; ++i) { Postura[i] = FVector4f(0, 0, 0, 0); Postura[AnchoPostura * 2 + i] = FVector4f(0, 0, 0, 0); }
}

void ACorpusCuerpo::MezclarFotogramas(const TArray<float>& F0, const TArray<float>& F1, float A)
{
	// cada fotograma: 8 números por articulación [índice, eje xyz, ángulo, traslación xyz]; se interpola el giro (slerp)
	struct FGiro { FQuat Q = FQuat::Identity; FVector T = FVector::ZeroVector; };
	TMap<int32, TPair<FGiro, FGiro>> Giros;
	for (int32 k = 0; k < 2; ++k)
	{
		const TArray<float>& Fr = k == 0 ? F0 : F1;
		for (int32 j = 0; j + 7 < Fr.Num(); j += 8)
		{
			FGiro& G = k == 0 ? Giros.FindOrAdd((int32)Fr[j]).Key : Giros.FindOrAdd((int32)Fr[j]).Value;
			const FVector Eje(Fr[j + 1], Fr[j + 2], Fr[j + 3]);
			G.Q = Eje.IsNearlyZero() ? FQuat::Identity : FQuat(Eje.GetSafeNormal(), Fr[j + 4]);
			G.T = FVector(Fr[j + 5], Fr[j + 6], Fr[j + 7]);
		}
	}
	for (const auto& Par : Giros)
	{
		if (Par.Key < 0 || Par.Key >= AnchoPostura) { continue; }
		const FQuat Q = FQuat::Slerp(Par.Value.Key.Q, Par.Value.Value.Q, A);
		FVector Eje; double Ang; Q.ToAxisAndAngle(Eje, Ang);
		if (Ang > PI) { Ang = 2.0 * PI - Ang; Eje = -Eje; }
		const FVector T = FMath::Lerp(Par.Value.Key.T, Par.Value.Value.T, A);
		Postura[Par.Key] = FVector4f((float)Eje.X, (float)Eje.Y, (float)Eje.Z, (float)Ang);
		Postura[AnchoPostura * 2 + Par.Key] = FVector4f((float)T.X, (float)T.Y, (float)T.Z, 0.f);
	}
}

// ───────── Marcha ─────────
// Los instantes vienen de la web (ángulos de laboratorio de Fukuchi 2018, Schreiber 2019 y Lencioni 2019; pelvis, centro de
// masas y pie apoyado en el suelo). Aquí se interpolan, se mueve el cuerpo entero con la raíz y se pinta la actividad muscular.

namespace
{
	float NivelEn(const TArray<FVector2f>& P, float Ciclo)
	{
		if (P.Num() == 0) { return 0.f; }
		Ciclo = FMath::Fmod(FMath::Fmod(Ciclo, 100.f) + 100.f, 100.f);
		for (int32 i = 1; i < P.Num(); ++i)
		{
			if (Ciclo <= P[i].X) { const float T = (Ciclo - P[i - 1].X) / FMath::Max(1e-6f, P[i].X - P[i - 1].X); return FMath::Lerp(P[i - 1].Y, P[i].Y, T); }
		}
		return P.Last().Y;
	}
	// amarillo → naranja → magenta (no rojo: se confunde con el músculo), como los estados lv1–lv5 de la web
	FLinearColor ColorNivel(float L)
	{
		const FLinearColor A(FColor::FromHex(TEXT("ffd23f"))), B(FColor::FromHex(TEXT("ff8a1f"))), C(FColor::FromHex(TEXT("e23fbf")));
		return L < 0.5f ? FMath::Lerp(A, B, L * 2.f) : FMath::Lerp(B, C, (L - 0.5f) * 2.f);
	}
}

void ACorpusCuerpo::PonerMarcha(int32 Patron, float Ciclo)
{
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	CrearTexturaPostura();
	const bool bAntes = HayPostura();
	const FCorpusPatronMarcha* P = (MovimientoDisponible() && D->PatronesMarcha().IsValidIndex(Patron) && D->PatronesMarcha()[Patron].Frames.Num() > 1) ? &D->PatronesMarcha()[Patron] : nullptr;
	const bool bCambiaPatron = (P ? Patron : -1) != PatronActual;
	if (P && RangoActual >= 0) { RangoActual = -1; bReproduciendo = false; GradosActual = 0.f; PintarAgonistas(TArray<FString>(), FString()); }
	if (P) { PonerCorrectivo(nullptr, 0, false, 0, 0, 0.f); }   // en la marcha los músculos van solo con sus pesos
	PatronActual = P ? Patron : -1;
	PosturaEnReposo();
	FTransform Raiz0 = FTransform::Identity;
	if (P)
	{
		CicloMarcha = FMath::Fmod(FMath::Fmod(Ciclo, 100.f) + 100.f, 100.f);
		const int32 N = P->Frames.Num();
		const float X = CicloMarcha / D->PasoMarcha();
		const int32 I0 = FMath::FloorToInt(X) % N, I1 = (I0 + 1) % N;
		const float A = X - FMath::FloorToFloat(X);
		MezclarFotogramas(P->Frames[I0], P->Frames[I1], A);
		if (P->Raiz.IsValidIndex(I0) && P->Raiz.IsValidIndex(I1) && P->Raiz[I0].Num() >= 7 && P->Raiz[I1].Num() >= 7)
		{
			// raíz del cuerpo en glTF → Unreal: Y y Z intercambiados (espejo): posición (x, z, y) · 100 y cuaternión (−x, −z, −y, w)
			const TArray<float>& R0 = P->Raiz[I0]; const TArray<float>& R1 = P->Raiz[I1];
			const FQuat Q = FQuat::Slerp(FQuat(-R0[0], -R0[2], -R0[1], R0[3]), FQuat(-R1[0], -R1[2], -R1[1], R1[3]), A);
			const FVector T = FMath::Lerp(FVector(R0[4], R0[6], R0[5]), FVector(R1[4], R1[6], R1[5]), A) * 100.0;
			Raiz0 = FTransform(Q, T);
		}
	}
	else { bMarchaEnCurso = false; }
	if (Raiz) { Raiz->SetRelativeTransform(Raiz0 * TransformBase); }
	SubirPostura();
	if (HayPostura() != bAntes) { for (auto& Par : Piezas) { if (Par.Value) { AjustarLimites(Par.Value); } } }

	// actividad muscular: cada grupo con su intensidad en este instante (lado derecho en el ciclo, izquierdo medio ciclo después)
	if (bCambiaPatron)
	{
		for (const FString& Id : IdsMarcha) { if (Id != IdSeleccionada) { PonerEstado(Id, FLinearColor::Black, 0.f); } }
		IdsMarcha.Reset(); GruposMarcha.Reset(); FijosMarcha.Reset();
		if (P)
		{
			TMap<FString, int32> GrupoDe;
			for (int32 g = 0; g < D->GruposMarcha().Num(); ++g) { for (const FString& En : D->GruposMarcha()[g].En) { GrupoDe.Add(En, g); } }
			const TSet<FString> Deb(P->Debiles), Esp(P->Espasticos);
			for (const auto& Par : Piezas)
			{
				const FCorpusPieza* Pz = D->Pieza(Par.Key);
				if (!Pz || Pz->Lado.IsEmpty()) { continue; }
				const bool bDer = Pz->Lado.StartsWith(TEXT("der"));
				// lado afectado de los patrones patológicos: el derecho. Débiles en turquesa, espásticos en naranja (como la web)
				if (bDer && Deb.Contains(Pz->En)) { FijosMarcha.Add(Par.Key, FLinearColor(FColor::FromHex(TEXT("2bc4c4")))); IdsMarcha.Add(Par.Key); continue; }
				if (bDer && Esp.Contains(Pz->En)) { FijosMarcha.Add(Par.Key, FLinearColor(FColor::FromHex(TEXT("f0a040")))); IdsMarcha.Add(Par.Key); continue; }
				if (const int32* G = GrupoDe.Find(Pz->En)) { GruposMarcha.Add(Par.Key, FIntPoint(*G, bDer ? 0 : 1)); IdsMarcha.Add(Par.Key); }
			}
		}
	}
	if (P)
	{
		for (const auto& Par : FijosMarcha) { if (Par.Key != IdSeleccionada) { PonerEstado(Par.Key, Par.Value, 0.7f); } }
		for (const auto& Par : GruposMarcha)
		{
			if (Par.Key == IdSeleccionada) { continue; }
			const float L = NivelEn(D->GruposMarcha()[Par.Value.X].Nivel, CicloMarcha + (Par.Value.Y ? 50.f : 0.f));
			PonerEstado(Par.Key, ColorNivel(FMath::Clamp(L / 0.6f, 0.f, 1.f)), L > 0.05f ? FMath::Clamp(0.25f + L, 0.f, 0.85f) : 0.f);
		}
	}
	AlCambiarPostura.Broadcast();
}

float ACorpusCuerpo::NivelDeGrupo(int32 Gi, bool bIzq) const
{
	const UCorpusDatos* D = Datos();
	return (D && PatronActual >= 0 && D->GruposMarcha().IsValidIndex(Gi)) ? NivelEn(D->GruposMarcha()[Gi].Nivel, CicloMarcha + (bIzq ? 50.f : 0.f)) : 0.f;
}

FString ACorpusCuerpo::TipoDeGrupo(int32 Gi) const
{
	const UCorpusDatos* D = Datos();
	if (!D || PatronActual < 0 || !D->GruposMarcha().IsValidIndex(Gi)) { return FString(); }
	const FCorpusGrupoMarcha& G = D->GruposMarcha()[Gi];
	bool bDentro = false;
	for (const FVector2f& T : G.Tramos) { if (CicloMarcha >= T.X && CicloMarcha <= T.Y) { bDentro = true; break; } }
	if (!bDentro) { return FString(); }
	FString Tipo;
	for (const auto& Par : G.Tipo) { if (Par.Key <= CicloMarcha) { Tipo = Par.Value; } }
	return Tipo;
}

FLinearColor ACorpusCuerpo::ColorDeNivel(float Nivel) { return ColorNivel(FMath::Clamp(Nivel / 0.6f, 0.f, 1.f)); }

int32 ACorpusCuerpo::FaseDeMarcha() const
{
	const UCorpusDatos* D = Datos();
	if (!D) { return -1; }
	for (int32 i = 0; i < D->FasesMarcha().Num(); ++i) { if (CicloMarcha >= D->FasesMarcha()[i].Ini && CicloMarcha < D->FasesMarcha()[i].Fin) { return i; } }
	return D->FasesMarcha().Num() - 1;
}

void ACorpusCuerpo::PonerRango(int32 Rango, int32 Mov, bool bIzq, float Grados)
{
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	CrearTexturaPostura();
	if (PatronActual >= 0 && Rango >= 0) { PonerMarcha(-1, 0.f); }   // un rango articular saca de la marcha
	const bool bAntes = HayPostura();
	const FCorpusRango* R = (MovimientoDisponible() && D->Rangos().IsValidIndex(Rango)) ? &D->Rangos()[Rango] : nullptr;
	const FCorpusMovimiento* M = (R && R->Movs.IsValidIndex(Mov)) ? &R->Movs[Mov] : nullptr;
	const bool bCambia = Rango != RangoActual || Mov != MovActual || bIzq != bLadoIzq;
	RangoActual = M ? Rango : -1; MovActual = M ? Mov : 0; bLadoIzq = M && bIzq;
	if (!M) { bReproduciendo = false; }

	PosturaEnReposo();
	bool bCorr = false;
	if (M)
	{
		const TArray<TArray<float>>& F = (bLadoIzq && M->Izquierdo.Num()) ? M->Izquierdo : M->Derecho;
		GradosActual = FMath::Clamp(Grados, 0.f, M->Max);
		if (F.Num() > 0)
		{
			// fotogramas cada Paso grados (el último, en el máximo exacto): se interpola entre los dos vecinos
			const int32 Ult = F.Num() - 1;
			const int32 I0 = FMath::Clamp(FMath::FloorToInt(GradosActual / M->Paso), 0, FMath::Max(Ult - 1, 0)), I1 = FMath::Min(I0 + 1, Ult);
			const float G0 = FMath::Min(I0 * M->Paso, M->Max), G1 = FMath::Min(I1 * M->Paso, M->Max);
			const float A = G1 > G0 ? FMath::Clamp((GradosActual - G0) / (G1 - G0), 0.f, 1.f) : 0.f;
			MezclarFotogramas(F[I0], F[I1], A);
			// músculos del hombro: su rejilla elástica en esos mismos dos cuadros
			PonerCorrectivo(R, MovActual, bLadoIzq && M->Izquierdo.Num() > 0, I0, I1, A);
			bCorr = true;
		}
	}
	else { GradosActual = 0.f; }
	if (!bCorr) { PonerCorrectivo(nullptr, 0, false, 0, 0, 0.f); }
	SubirPostura();

	if (HayPostura() != bAntes) { for (auto& Par : Piezas) { if (Par.Value) { AjustarLimites(Par.Value); } } }
	if (bCambia)
	{
		// agonistas: los del lado que se mueve (en el tronco y el cuello, ambos lados)
		PintarAgonistas(M ? M->Agonistas : TArray<FString>(), (R && R->bLados) ? FString(bLadoIzq ? TEXT("izq") : TEXT("der")) : FString());
	}
	AlCambiarPostura.Broadcast();
}

void ACorpusCuerpo::Tick(float Dt)
{
	Super::Tick(Dt);
	if (PatronActual >= 0 && bMarchaEnCurso)
	{
		// un ciclo cada 1,1 s (4,4 s a cámara lenta), como la web; los patrones patológicos llevan su propia velocidad
		const UCorpusDatos* D = Datos();
		const float Vel = (D && D->PatronesMarcha().IsValidIndex(PatronActual)) ? D->PatronesMarcha()[PatronActual].Velocidad : 1.f;
		PonerMarcha(PatronActual, CicloMarcha + Dt * 100.f * Vel / (bMarchaLenta ? 4.4f : 1.1f));
		return;
	}
	if (!bReproduciendo || RangoActual < 0) { return; }
	// ida y vuelta entre 0 y el máximo con aceleración y frenado suaves (medio coseno): sale despacio, pasa por el centro
	// del rango a la velocidad máxima y frena al llegar al tope, como un movimiento real. La media sigue siendo de unos
	// 45° por segundo (la web va a velocidad constante); los rangos cortos tardan al menos 1,2 s.
	const float Max = GradosMax();
	if (Max <= 0.f) { return; }
	const float Duracion = FMath::Max(Max / 45.f, 1.2f);
	FaseRepro += SentidoRepro * Dt / Duracion;
	if (FaseRepro >= 1.f) { FaseRepro = 1.f; SentidoRepro = -1.f; }
	if (FaseRepro <= 0.f) { FaseRepro = 0.f; SentidoRepro = 1.f; }
	PonerRango(RangoActual, MovActual, bLadoIzq, Max * 0.5f * (1.f - FMath::Cos(PI * FaseRepro)));
}

void ACorpusCuerpo::Reproducir(bool bSi)
{
	bReproduciendo = bSi && RangoActual >= 0;
	if (bReproduciendo)
	{
		// fase que corresponde al ángulo actual (el deslizador puede haberlo dejado en cualquier punto)
		const float Max = GradosMax();
		FaseRepro = Max > 0.f ? FMath::Acos(FMath::Clamp(1.f - 2.f * GradosActual / Max, -1.f, 1.f)) / PI : 0.f;
		if (FaseRepro >= 1.f) { SentidoRepro = -1.f; } else if (FaseRepro <= 0.f) { SentidoRepro = 1.f; }
	}
	AlCambiarPostura.Broadcast();
}

// ───────── Plano de corte ─────────
// Los dos materiales maestros leen la colección MPC_Corte (corpus_importar.py → _corte): «Activo» y «Plano» (normal del
// mundo en xyz y posición en w, en cm). Se dibuja lo que queda en dot(punto, normal) ≤ w.

void ACorpusCuerpo::PonerCorte(int32 Eje, float Pos)
{
	if (!ColeccionCorte) { ColeccionCorte = LoadObject<UMaterialParameterCollection>(nullptr, TEXT("/Game/Corpus/Materiales/MPC_Corte.MPC_Corte")); }
	UMaterialParameterCollectionInstance* Inst = (ColeccionCorte && GetWorld()) ? GetWorld()->GetParameterCollectionInstance(ColeccionCorte) : nullptr;
	const bool bActivo = Eje >= 0 && Eje <= 2 && Inst;
	const bool bCambia = (bActivo ? Eje : -1) != EjeDeCorte || bCorteInv != bCorteInvPintado;
	EjeDeCorte = bActivo ? Eje : -1;
	PosDeCorte = FMath::Clamp(Pos, 0.f, 1.f);
	if (bActivo)
	{
		// ejes del mundo: X de lado a lado (sagital), Y de atrás adelante (coronal), Z de abajo arriba (axial)
		const FBox B = Caja(FString());
		const double Min = B.IsValid ? B.Min[Eje] : -100.0, Max = B.IsValid ? B.Max[Eje] : 100.0;
		const double D = FMath::Lerp(Min, Max, (double)PosDeCorte);
		FVector N = FVector::ZeroVector; N[Eje] = 1.0;
		PlanoCorte = bCorteInv ? FVector4(-N.X, -N.Y, -N.Z, -D) : FVector4(N.X, N.Y, N.Z, D);
		Inst->SetVectorParameterValue(TEXT("Plano"), FLinearColor((float)PlanoCorte.X, (float)PlanoCorte.Y, (float)PlanoCorte.Z, (float)PlanoCorte.W));
	}
	if (!bActivo) { bCorteInv = false; }
	bCorteInvPintado = bCorteInv;
	if (Inst) { Inst->SetScalarParameterValue(TEXT("Activo"), bActivo ? 1.f : 0.f); }
	// mover la posición no rehace la interfaz (el deslizador se está arrastrando); cambiar de eje, invertir o apagar, sí
	if (bCambia) { AlCambiarHerramientas.Broadcast(); }
}

bool ACorpusCuerpo::Cortado(const FVector& Punto) const
{
	return EjeDeCorte >= 0 && (Punto.X * PlanoCorte.X + Punto.Y * PlanoCorte.Y + Punto.Z * PlanoCorte.Z) > PlanoCorte.W;
}

// ───────── Fantasma y pelar capas ─────────

void ACorpusCuerpo::FantasmaCapas(const TSet<FString>& Solidas)
{
	// las capas a la vista que no son «sólidas» pasan a casi transparentes; se guarda la opacidad que tenían
	const TArray<FString> Visibles = CapasVisibles.Array();
	for (const FString& Clave : Visibles)
	{
		if (Solidas.Contains(Clave) || OpacidadesFantasma.Contains(Clave)) { continue; }
		OpacidadesFantasma.Add(Clave, OpacidadDeCapa(Clave));
		OpacidadCapa(Clave, FMath::Min(OpacidadDeCapa(Clave), 0.25f));
	}
	bFantasma = true;
	for (const FString& Clave : Visibles) { AplicarVisibilidad(Clave); }   // el clic atraviesa las capas fantasma
}

void ACorpusCuerpo::Fantasma(bool bSi)
{
	if (bSi == bFantasma) { return; }
	if (bSi)
	{
		// capa que queda sólida: la de la pieza seleccionada; sin selección, los huesos
		const UCorpusDatos* D = Datos();
		const FCorpusPieza* P = D ? D->Pieza(IdSeleccionada) : nullptr;
		FString Solida = P ? CapaDePieza(*P) : FString();
		if (Solida.IsEmpty() && D) { for (const FCorpusCapa& C : D->Capas()) { if (C.Base == TEXT("oseo") && CapasVisibles.Contains(C.Clave)) { Solida = C.Clave; break; } } }
		FantasmaCapas(TSet<FString>({ Solida }));
	}
	else
	{
		bFantasma = false;
		const TMap<FString, float> Antes = MoveTemp(OpacidadesFantasma);
		OpacidadesFantasma.Reset();
		for (const auto& Par : Antes) { OpacidadCapa(Par.Key, Par.Value); AplicarVisibilidad(Par.Key); }
	}
	AlCambiarCapas.Broadcast();
	AlCambiarHerramientas.Broadcast();
}

// ───────── Mapa de origen e inserción ─────────
// Las áreas son las mallas de la capa «insercion» (llevan el nombre y el lado de su músculo; el catálogo dice si son origen
// o inserción). Sobre qué hueso está cada una lo calcula tools/unreal/inserciones.js (inserciones.json).

TArray<FString> ACorpusCuerpo::AreasDe(const FString& Id) const
{
	TArray<FString> Fuera;
	const UCorpusDatos* D = Datos();
	const FCorpusPieza* P = D ? D->Pieza(Id) : nullptr;
	if (!P) { return Fuera; }
	const FCorpusCapa* Capa = D->Capa(CapaDePieza(*P));
	if (!Capa || Capa->Clave == TEXT("insercion")) { return Fuera; }
	const bool bHueso = Capa->Base == TEXT("oseo");
	const FString Cuerpo = CarpetaCuerpo();
	for (const auto& Par : D->TodasLasPiezas())
	{
		const FCorpusPieza& A = Par.Value;
		if (A.Sistema != TEXT("insercion") || CapaDePieza(A) != TEXT("insercion")) { continue; }
		if (bHueso ? (D->HuesoDeInsercion(Cuerpo, A.Id) == Id) : (A.En == P->En && A.Lado == P->Lado)) { Fuera.Add(A.Id); }
	}
	return Fuera;
}

bool ACorpusCuerpo::TieneInserciones(const FString& Id) const { return AreasDe(Id).Num() > 0; }

void ACorpusCuerpo::MapaInserciones(bool bSi)
{
	const UCorpusDatos* D = Datos();
	for (const FString& Id : IdsMapa) { if (Id != IdSeleccionada) { PonerEstado(Id, FLinearColor::Black, 0.f); } }
	IdsMapa.Reset();
	bMapa = false;
	if (bSi && D)
	{
		const TArray<FString> Areas = AreasDe(IdSeleccionada);
		if (Areas.Num() > 0)
		{
			CargarCapa(TEXT("insercion"));
			for (const FString& Id : Areas)
			{
				const FCorpusPieza* A = D->Pieza(Id);
				if (!A || !Piezas.Contains(Id)) { continue; }
				IdsMapa.Add(Id);
				PonerEstado(Id, UCorpusDatos::EsOrigen(*A) ? ColorOrigen() : ColorInsercion(), 0.95f);
			}
			bMapa = IdsMapa.Num() > 0;
		}
	}
	AplicarVisibilidad(TEXT("insercion"));
	// con el mapa a la vista la pieza seleccionada pierde su tinte azul (queda el contorno): se confundiría con las inserciones
	if (!IdSeleccionada.IsEmpty() && !IdsMapa.Contains(IdSeleccionada)) { PonerEstado(IdSeleccionada, COLOR_SELECCION, bMapa ? 0.f : 0.55f); }
	// lo que tapa el hueso (músculos, ligamentos…) queda translúcido mientras se mira el mapa
	if (bMapa && !bFantasma)
	{
		TSet<FString> Solidas; Solidas.Add(TEXT("insercion"));
		if (D) { for (const FCorpusCapa& C : D->Capas()) { if (C.Base == TEXT("oseo")) { Solidas.Add(C.Clave); } } }
		bFantasmaPorMapa = true;
		FantasmaCapas(Solidas);
	}
	else if (!bMapa && bFantasmaPorMapa) { bFantasmaPorMapa = false; Fantasma(false); }
	AlCambiarCapas.Broadcast();
	AlCambiarHerramientas.Broadcast();
}

void ACorpusCuerpo::PelarProfundidad(const FString& Prof, bool bOcultar)
{
	if (bOcultar) { ProfOcultas.Add(Prof); } else { ProfOcultas.Remove(Prof); }
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
	AlCambiarCapas.Broadcast();
}

void ACorpusCuerpo::CargarCapa(const FString& Clave)
{
	if (CapasCargadas.Contains(Clave)) { return; }
	CapasCargadas.Add(Clave);
	UCorpusDatos* D = Datos();
	const FCorpusCapa* Capa = D ? D->Capa(Clave) : nullptr;
	if (!Capa) { return; }

	const FString Cuerpo = CarpetaCuerpo();
	const bool bTrans = OpacidadDeCapa(Clave) < 0.999f;
	UMaterialInterface* Mat = MaterialDe(Capa->Base, bTrans);
	TArray<FString>& Ids = IdsPorCapa.FindOrAdd(Clave);

	for (const auto& Par : D->TodasLasPiezas())
	{
		const FCorpusPieza& P = Par.Value;
		// La mujer usa su propia malla si la pieza cambia (pelvis, periné…) y, si no, la del hombre.
		FString Carpeta = Cuerpo;
		const FCorpusMalla* M = P.Mallas.Find(Cuerpo);
		if (!M && CuerpoActual == ECorpusCuerpo::Mujer && !D->EsSoloHombre(P.Id)) { M = P.Mallas.Find(TEXT("hombre")); Carpeta = TEXT("hombre"); }
		if (!M || M->Sistema != Clave || Piezas.Contains(P.Id)) { continue; }

		const FString Ruta = FString::Printf(TEXT("%s/%s/%s/%s.%s"), RUTA_MALLAS, *Carpeta, *Clave, *P.Id, *P.Id);
		UStaticMesh* Malla = LoadObject<UStaticMesh>(nullptr, *Ruta);
		if (!Malla) { continue; }

		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, FName(*(TEXT("P_") + P.Id)));
		C->SetMobility(EComponentMobility::Movable); // el rig de movimiento moverá huesos y deformará músculos
		C->SetStaticMesh(Malla);
		if (Mat) { C->SetMaterial(0, Mat); }
		C->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
		C->SetCollisionResponseToAllChannels(ECR_Ignore);
		C->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
		C->SetCastShadow(!bTrans);
		C->bDisallowNanite = bTrans;        // Nanite no dibuja materiales translúcidos: la capa usa la malla clásica
		C->SetForceDisableNanite(bTrans);
		C->SetupAttachment(Raiz);
		C->RegisterComponent();
		C->SetCustomPrimitiveDataVector4(0, FVector4(0, 0, 0, 0));          // estado: color + fuerza
		C->SetCustomPrimitiveDataFloat(4, OpacidadDeCapa(Clave));          // opacidad de la capa
		C->SetCustomPrimitiveDataVector4(5, FVector4(M->Tinte.R, M->Tinte.G, M->Tinte.B, M->Tinte.A)); // color propio del órgano + peso
		// articulaciones que mueven esta malla (el material lee sus pesos de los UV y su orden de aquí)
		if (const TArray<float>* H = D->HuecosMovimiento(Carpeta, P.Id))
		{
			float V[8] = { 0, 0, 0, 0, 0, 0, 0, 0 };
			for (int32 i = 0; i < FMath::Min(8, H->Num()); ++i) { V[i] = (*H)[i]; }
			C->SetCustomPrimitiveDataVector4(12, FVector4(V[0], V[1], V[2], V[3]));
			C->SetCustomPrimitiveDataVector4(16, FVector4(V[4], V[5], V[6], V[7]));
		}
		// 1 = pegada a la parrilla costal; 2 = además cubre el ángulo inferior de la escápula (dorsal ancho)
		C->SetCustomPrimitiveDataFloat(20, D->SePegaAlTorax(Carpeta, P.Id) ? (P.En.StartsWith(TEXT("Latissimus")) ? 2.f : 1.f) : 0.f);
		if (const FVector3f* Ins = D->InsercionFibra(Carpeta, P.Id))   // fibra tensa: el material estira el músculo hacia donde va este punto
		{
			C->SetCustomPrimitiveDataFloat(21, Ins->X); C->SetCustomPrimitiveDataFloat(22, Ins->Y); C->SetCustomPrimitiveDataFloat(23, Ins->Z);
		}
		// correctivo elástico: dónde está la rejilla de esta pieza en la textura y cómo se mide (datos primitivos 24–31)
		if (const FCorpusRejilla* Rj = D->Rejilla(Carpeta, P.Id))
		{
			C->SetCustomPrimitiveDataVector4(24, FVector4((float)Rj->Base, (float)Rj->N.X, (float)Rj->N.Y, (float)Rj->N.Z));
			C->SetCustomPrimitiveDataVector4(28, FVector4(Rj->O.X, Rj->O.Y, Rj->O.Z, Rj->H));
		}
		if (HayPostura()) { AjustarLimites(C); }
		Piezas.Add(P.Id, C);
		Ids.Add(P.Id);
	}
}

void ACorpusCuerpo::AplicarVisibilidad(const FString& Clave)
{
	const TArray<FString>* Ids = IdsPorCapa.Find(Clave);
	if (!Ids) { return; }
	const bool bCapa = CapasVisibles.Contains(Clave);
	const UCorpusDatos* D = Datos();
	const FCorpusCapa* Capa = D ? D->Capa(Clave) : nullptr;
	// pelar capas: solo los músculos tienen profundidad (superficial, intermedio, profundo)
	const bool bPelar = ProfOcultas.Num() > 0 && Capa && Capa->Base == TEXT("muscular");
	// las capas fantasma se ven pero no se tocan: el clic llega a la capa sólida de debajo
	const bool bTocable = !(bFantasma && OpacidadesFantasma.Contains(Clave));
	for (const FString& Id : *Ids)
	{
		if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id))
		{
			bool bVer = bCapa && !Ocultas.Contains(Id) && (IdAislada.IsEmpty() || IdAislada == Id) && (Grupo.Num() == 0 || Grupo.Contains(Id));
			if (bMapa && IdsMapa.Contains(Id)) { bVer = true; }   // mapa de origen e inserción: sus áreas se ven aunque la capa esté apagada
			if (bVer && bPelar && ProfOcultas.Contains(D->Profundidad(Id))) { bVer = false; }
			(*C)->SetVisibility(bVer);
			(*C)->SetCollisionEnabled(bVer && bTocable ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
		}
	}
}

void ACorpusCuerpo::MostrarCapa(const FString& Clave, bool bVisible)
{
	if (bVisible && !CapaDisponible(Clave)) { return; }
	if (bVisible) { CapasVisibles.Add(Clave); CargarCapa(Clave); }
	else { CapasVisibles.Remove(Clave); }
	AplicarVisibilidad(Clave);
	AlCambiarCapas.Broadcast();
}

float ACorpusCuerpo::OpacidadDeCapa(const FString& Clave) const
{
	const float* O = Opacidades.Find(Clave);
	return O ? *O : 1.f;
}

void ACorpusCuerpo::OpacidadCapa(const FString& Clave, float Opacidad)
{
	Opacidad = FMath::Clamp(Opacidad, 0.05f, 1.f);
	const bool bAntes = OpacidadDeCapa(Clave) < 0.999f, bAhora = Opacidad < 0.999f;
	Opacidades.Add(Clave, Opacidad);
	const UCorpusDatos* D = Datos();
	const FCorpusCapa* Capa = D ? D->Capa(Clave) : nullptr;
	UMaterialInterface* Mat = (Capa && bAntes != bAhora) ? MaterialDe(Capa->Base, bAhora) : nullptr;
	if (const TArray<FString>* Ids = IdsPorCapa.Find(Clave))
	{
		for (const FString& Id : *Ids)
		{
			if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id))
			{
				if (Mat)
				{
					// Nanite solo admite materiales opacos o enmascarados: la capa translúcida usa la malla clásica
					(*C)->bDisallowNanite = bAhora;
					(*C)->SetForceDisableNanite(bAhora);
					(*C)->SetMaterial(0, Mat); (*C)->SetCastShadow(!bAhora);
					(*C)->MarkRenderStateDirty();
				}
				(*C)->SetCustomPrimitiveDataFloat(4, Opacidad);
			}
		}
	}
}

void ACorpusCuerpo::PonerEstado(const FString& Id, const FLinearColor& Color, float Fuerza)
{
	if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id))
	{
		(*C)->SetCustomPrimitiveDataVector4(0, FVector4(Color.R, Color.G, Color.B, Fuerza));
	}
}

void ACorpusCuerpo::Seleccionar(const FString& Id)
{
	if (Id == IdSeleccionada) { return; }
	// el mapa de origen e inserción es de la pieza con la que se encendió: se apaga al elegir otra (salvo una de sus áreas)
	if (bMapa && !IdsMapa.Contains(Id)) { MapaInserciones(false); }
	if (!IdSeleccionada.IsEmpty())
	{
		const UCorpusDatos* D = Datos();
		const FCorpusPieza* Area = (bMapa && D && IdsMapa.Contains(IdSeleccionada)) ? D->Pieza(IdSeleccionada) : nullptr;
		if (Area) { PonerEstado(IdSeleccionada, UCorpusDatos::EsOrigen(*Area) ? ColorOrigen() : ColorInsercion(), 0.95f); }
		else { PonerEstado(IdSeleccionada, FLinearColor::Black, 0.f); }
		if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(IdSeleccionada)) { (*C)->SetRenderCustomDepth(false); }
	}
	IdSeleccionada = Piezas.Contains(Id) ? Id : FString();
	if (!IdSeleccionada.IsEmpty())
	{
		PonerEstado(IdSeleccionada, COLOR_SELECCION, 0.55f);
		// contorno de selección: el post-proceso del mapa lee la profundidad personalizada (plantilla 1)
		UStaticMeshComponent* C = Piezas[IdSeleccionada];
		C->SetRenderCustomDepth(true);
		C->SetCustomDepthStencilValue(1);
	}
	AlCambiarSeleccion.Broadcast();
}

void ACorpusCuerpo::Ocultar(const FString& Id)
{
	const UCorpusDatos* D = Datos();
	if (!Piezas.Contains(Id) || !D) { return; }
	Ocultas.Add(Id);
	if (Id == IdSeleccionada) { Seleccionar(FString()); }
	for (const auto& Par : IdsPorCapa) { if (Par.Value.Contains(Id)) { AplicarVisibilidad(Par.Key); break; } }
}

void ACorpusCuerpo::Aislar(const FString& Id)
{
	IdAislada = (IdAislada == Id) ? FString() : Id;
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
}

void ACorpusCuerpo::VerSolo(const TArray<FString>& Ids)
{
	Grupo = TSet<FString>(Ids);
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
}

void ACorpusCuerpo::MostrarTodo()
{
	Grupo.Reset();
	Ocultas.Reset();
	IdAislada.Reset();
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
}

// ───────── Estudio ─────────

FString ACorpusCuerpo::CapaDePieza(const FCorpusPieza& P) const
{
	// misma regla que CargarCapa: la mujer usa la malla del hombre si la pieza no cambia
	const UCorpusDatos* D = Datos();
	const FCorpusMalla* M = P.Mallas.Find(CarpetaCuerpo());
	if (!M && D && CuerpoActual == ECorpusCuerpo::Mujer && !D->EsSoloHombre(P.Id)) { M = P.Mallas.Find(TEXT("hombre")); }
	return M ? M->Sistema : FString();
}

TArray<FString> ACorpusCuerpo::IdsDeNombres(const TArray<FString>& En, const FString& Lado) const
{
	TArray<FString> Ids;
	const UCorpusDatos* D = Datos();
	if (!D || En.Num() == 0) { return Ids; }
	const TSet<FString> Nombres(En);
	const FString Quiero = Lado == TEXT("d") ? TEXT("derecho") : Lado == TEXT("i") ? TEXT("izquierdo") : FString();
	for (const auto& Par : D->TodasLasPiezas())
	{
		const FCorpusPieza& P = Par.Value;
		if (!Nombres.Contains(P.En) || P.Sistema == TEXT("insercion")) { continue; }   // los orígenes e inserciones llevan el nombre del músculo
		if (!Quiero.IsEmpty() && !P.Lado.IsEmpty() && P.Lado != Quiero) { continue; }
		const FString Capa = CapaDePieza(P);
		if (Capa.IsEmpty() || !CapaDisponible(Capa)) { continue; }
		Ids.Add(P.Id);
	}
	return Ids;
}

void ACorpusCuerpo::Ensenar(const TArray<FString>& Ids, const TArray<FString>& Capas)
{
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	TSet<FString> Encender(Capas);
	for (const FString& Id : Ids) { if (const FCorpusPieza* P = D->Pieza(Id)) { const FString C = CapaDePieza(*P); if (!C.IsEmpty()) { Encender.Add(C); } } }
	for (const FString& Clave : Encender)
	{
		if (CapasVisibles.Contains(Clave) || !CapaDisponible(Clave)) { continue; }
		CapasVisibles.Add(Clave); CargarCapa(Clave);
	}
	Ocultas.Reset(); IdAislada.Reset();
	Grupo = TSet<FString>(Ids);
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
	AlCambiarCapas.Broadcast();
}

void ACorpusCuerpo::PonerVista(const FCorpusVistaPaso& V)
{
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	// los ids de las piezas aisladas son los del cuerpo con el que la web hace ese recorrido
	const ECorpusCuerpo Quiero = V.bMujer ? ECorpusCuerpo::Mujer : ECorpusCuerpo::Hombre;
	if (CuerpoActual != Quiero) { Grupo.Reset(); PonerCuerpo(Quiero); }
	for (const FCorpusCapa& C : D->Capas())
	{
		if (!CapaDisponible(C.Clave)) { continue; }
		const float* Op = V.Capas.Find(C.Clave);
		if (Op)
		{
			if (!FMath::IsNearlyEqual(OpacidadDeCapa(C.Clave), *Op, 0.01f)) { OpacidadCapa(C.Clave, *Op); }
			if (!CapasVisibles.Contains(C.Clave)) { CapasVisibles.Add(C.Clave); CargarCapa(C.Clave); }
		}
		else { CapasVisibles.Remove(C.Clave); }
	}
	Ocultas = TSet<FString>(V.Ocultas); IdAislada.Reset();
	Grupo = V.bIso ? TSet<FString>(V.Iso) : TSet<FString>();
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
	AlCambiarCapas.Broadcast();
}

void ACorpusCuerpo::GuardarEstado()
{
	if (bHayGuardado) { return; }
	if (bMapa) { MapaInserciones(false); }
	if (bFantasma) { Fantasma(false); }   // se guarda el estado real de las capas, no el del modo fantasma
	bHayGuardado = true;
	CuerpoGuardado = CuerpoActual; CapasGuardadas = CapasVisibles; OpacidadesGuardadas = Opacidades;
}

void ACorpusCuerpo::RestaurarEstado()
{
	if (!bHayGuardado) { return; }
	bHayGuardado = false;
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	if (CuerpoActual != CuerpoGuardado) { PonerCuerpo(CuerpoGuardado); }
	Grupo.Reset(); Ocultas.Reset(); IdAislada.Reset();
	for (const FCorpusCapa& C : D->Capas())
	{
		if (!CapaDisponible(C.Clave)) { continue; }
		if (const float* Op = OpacidadesGuardadas.Find(C.Clave)) { if (!FMath::IsNearlyEqual(OpacidadDeCapa(C.Clave), *Op, 0.01f)) { OpacidadCapa(C.Clave, *Op); } }
		if (CapasGuardadas.Contains(C.Clave)) { if (!CapasVisibles.Contains(C.Clave)) { CapasVisibles.Add(C.Clave); CargarCapa(C.Clave); } }
		else { CapasVisibles.Remove(C.Clave); }
	}
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
	AlCambiarCapas.Broadcast();
}

FString ACorpusCuerpo::IdDe(const UPrimitiveComponent* Comp) const
{
	if (!Comp || Comp->GetOwner() != this) { return FString(); }
	FString N = Comp->GetName();
	return N.RemoveFromStart(TEXT("P_")) ? N : FString();
}

FBox ACorpusCuerpo::Caja(const FString& Id) const
{
	// caja de reposo: con la postura puesta los límites están agrandados (BoundsScale) y se deshace ese aumento
	const auto CajaDe = [](const UStaticMeshComponent* C)
	{
		return FBox::BuildAABB(C->Bounds.Origin, C->Bounds.BoxExtent / FMath::Max(C->BoundsScale, 1e-3f));
	};
	FBox B(ForceInit);
	if (!Id.IsEmpty())
	{
		if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id)) { B = CajaDe(*C); }
		return B;
	}
	for (const auto& Par : Piezas) { if (Par.Value && Par.Value->IsVisible()) { B += CajaDe(Par.Value); } }
	return B;
}

void ACorpusCuerpo::DescargarTodo()
{
	for (auto& Par : Piezas) { if (Par.Value) { Par.Value->DestroyComponent(); } }
	Piezas.Reset(); IdsPorCapa.Reset(); CapasCargadas.Reset(); Ocultas.Reset(); IdAislada.Reset(); IdSeleccionada.Reset();
	IdsMapa.Reset(); bMapa = false;
}

void ACorpusCuerpo::PonerCuerpo(ECorpusCuerpo Nuevo)
{
	if (Nuevo == CuerpoActual) { return; }
	if (bMapa) { MapaInserciones(false); }
	if (bFantasma) { Fantasma(false); }
	if (Nuevo == ECorpusCuerpo::VisibleHuman) { QuitarPostura(); }
	if (PatronActual >= 0) { PonerMarcha(-1, 0.f); }
	IdsMarcha.Reset(); GruposMarcha.Reset(); FijosMarcha.Reset();   // el Visible Human no tiene rig
	IdsAgonistas.Reset();
	const bool bDeVH = CuerpoActual == ECorpusCuerpo::VisibleHuman, bAVH = Nuevo == ECorpusCuerpo::VisibleHuman;
	TSet<FString> Antes = CapasVisibles;
	DescargarTodo();
	CapasVisibles.Reset();
	CuerpoActual = Nuevo;
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	for (const FCorpusCapa& C : D->Capas())
	{
		if (!CapaDisponible(C.Clave)) { continue; }
		// equivalencias entre sexos (piel ↔ piel_f, reproductor ↔ reproductor_f); al entrar o salir del Visible Human, capas de inicio
		bool bVer = (bDeVH || bAVH) ? C.bActivaAlInicio : Antes.Contains(C.Clave);
		if (!bVer && !bDeVH && !bAVH)
		{
			if (C.Clave == TEXT("piel_f")) { bVer = Antes.Contains(TEXT("piel")); }
			else if (C.Clave == TEXT("piel")) { bVer = Antes.Contains(TEXT("piel_f")); }
			else if (C.Clave == TEXT("reproductor_f")) { bVer = Antes.Contains(TEXT("reproductor")); }
			else if (C.Clave == TEXT("reproductor")) { bVer = Antes.Contains(TEXT("reproductor_f")); }
			else if (C.Clave == TEXT("mama")) { bVer = true; }
		}
		if (bVer) { MostrarCapa(C.Clave, true); }
	}
	AlCambiarSeleccion.Broadcast();
	AlCambiarCapas.Broadcast();
}
