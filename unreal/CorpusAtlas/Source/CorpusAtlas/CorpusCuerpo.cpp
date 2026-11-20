#include "CorpusCuerpo.h"
#include "CorpusDatos.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/GameInstance.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
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
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Mat, this);
		MID->SetTextureParameterValue(TEXT("Postura"), TexPostura);
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
	C->SetBoundsScale(RangoActual >= 0 ? FMath::Clamp((Radio + ALCANCE_POSTURA) / Radio, 1.f, 400.f) : 1.f);
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

void ACorpusCuerpo::PonerRango(int32 Rango, int32 Mov, bool bIzq, float Grados)
{
	const UCorpusDatos* D = Datos();
	if (!D) { return; }
	CrearTexturaPostura();
	const bool bAntes = RangoActual >= 0;
	const FCorpusRango* R = (MovimientoDisponible() && D->Rangos().IsValidIndex(Rango)) ? &D->Rangos()[Rango] : nullptr;
	const FCorpusMovimiento* M = (R && R->Movs.IsValidIndex(Mov)) ? &R->Movs[Mov] : nullptr;
	const bool bCambia = Rango != RangoActual || Mov != MovActual || bIzq != bLadoIzq;
	RangoActual = M ? Rango : -1; MovActual = M ? Mov : 0; bLadoIzq = M && bIzq;
	if (!M) { bReproduciendo = false; }

	// reposo: ángulos y traslaciones a cero (los pivotes no cambian)
	for (int32 i = 0; i < AnchoPostura; ++i) { Postura[i] = FVector4f(0, 0, 0, 0); Postura[AnchoPostura * 2 + i] = FVector4f(0, 0, 0, 0); }
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
			struct FGiro { FQuat Q = FQuat::Identity; FVector T = FVector::ZeroVector; };
			TMap<int32, TPair<FGiro, FGiro>> Giros;
			for (int32 k = 0; k < 2; ++k)
			{
				const TArray<float>& Fr = F[k == 0 ? I0 : I1];
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
	}
	else { GradosActual = 0.f; }
	SubirPostura();

	if ((RangoActual >= 0) != bAntes) { for (auto& Par : Piezas) { if (Par.Value) { AjustarLimites(Par.Value); } } }
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
	if (!bReproduciendo || RangoActual < 0) { return; }
	// ida y vuelta entre 0 y el máximo, a unos 45° por segundo (como el botón ▶ de la web)
	const float Max = GradosMax();
	float G = GradosActual + SentidoRepro * 45.f * Dt;
	if (G >= Max) { G = Max; SentidoRepro = -1.f; }
	if (G <= 0.f) { G = 0.f; SentidoRepro = 1.f; }
	PonerRango(RangoActual, MovActual, bLadoIzq, G);
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
		if (RangoActual >= 0) { AjustarLimites(C); }
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
			const bool bVer = bCapa && !Ocultas.Contains(Id) && (IdAislada.IsEmpty() || IdAislada == Id) && (Grupo.Num() == 0 || Grupo.Contains(Id));
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
}

void ACorpusCuerpo::PonerCuerpo(ECorpusCuerpo Nuevo)
{
	if (Nuevo == CuerpoActual) { return; }
	if (Nuevo == ECorpusCuerpo::VisibleHuman) { QuitarPostura(); }   // el Visible Human no tiene rig
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
