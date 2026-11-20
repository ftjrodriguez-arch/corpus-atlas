#include "CorpusCuerpo.h"
#include "CorpusDatos.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/GameInstance.h"
#include "Materials/MaterialInterface.h"

namespace
{
	const TCHAR* RUTA_MALLAS = TEXT("/Game/Corpus/Mallas");
	const TCHAR* RUTA_MATERIALES = TEXT("/Game/Corpus/Materiales");
	const FLinearColor COLOR_SELECCION(0.10f, 0.55f, 1.0f); // azul de selección de la web
}

ACorpusCuerpo::ACorpusCuerpo()
{
	PrimaryActorTick.bCanEverTick = false;
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
	Materiales.Add(Nombre, Mat);
	return Mat;
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
		C->SetupAttachment(Raiz);
		C->RegisterComponent();
		C->SetCustomPrimitiveDataVector4(0, FVector4(0, 0, 0, 0));          // estado: color + fuerza
		C->SetCustomPrimitiveDataFloat(4, OpacidadDeCapa(Clave));          // opacidad de la capa
		Piezas.Add(P.Id, C);
		Ids.Add(P.Id);
	}
}

void ACorpusCuerpo::AplicarVisibilidad(const FString& Clave)
{
	const TArray<FString>* Ids = IdsPorCapa.Find(Clave);
	if (!Ids) { return; }
	const bool bCapa = CapasVisibles.Contains(Clave);
	for (const FString& Id : *Ids)
	{
		if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id))
		{
			const bool bVer = bCapa && !Ocultas.Contains(Id) && (IdAislada.IsEmpty() || IdAislada == Id);
			(*C)->SetVisibility(bVer);
			(*C)->SetCollisionEnabled(bVer ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
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
				if (Mat) { (*C)->SetMaterial(0, Mat); (*C)->SetCastShadow(!bAhora); }
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
	if (!IdSeleccionada.IsEmpty())
	{
		PonerEstado(IdSeleccionada, FLinearColor::Black, 0.f);
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

void ACorpusCuerpo::MostrarTodo()
{
	Ocultas.Reset();
	IdAislada.Reset();
	for (const auto& Par : IdsPorCapa) { AplicarVisibilidad(Par.Key); }
}

FString ACorpusCuerpo::IdDe(const UPrimitiveComponent* Comp) const
{
	if (!Comp || Comp->GetOwner() != this) { return FString(); }
	FString N = Comp->GetName();
	return N.RemoveFromStart(TEXT("P_")) ? N : FString();
}

FBox ACorpusCuerpo::Caja(const FString& Id) const
{
	FBox B(ForceInit);
	if (!Id.IsEmpty())
	{
		if (const TObjectPtr<UStaticMeshComponent>* C = Piezas.Find(Id)) { B = (*C)->Bounds.GetBox(); }
		return B;
	}
	for (const auto& Par : Piezas) { if (Par.Value && Par.Value->IsVisible()) { B += Par.Value->Bounds.GetBox(); } }
	return B;
}

void ACorpusCuerpo::DescargarTodo()
{
	for (auto& Par : Piezas) { if (Par.Value) { Par.Value->DestroyComponent(); } }
	Piezas.Reset(); IdsPorCapa.Reset(); CapasCargadas.Reset(); Ocultas.Reset(); IdAislada.Reset(); IdSeleccionada.Reset();
}

void ACorpusCuerpo::PonerCuerpo(ECorpusCuerpo Nuevo)
{
	if (Nuevo == CuerpoActual) { return; }
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
