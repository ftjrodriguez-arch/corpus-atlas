#include "CorpusJugador.h"
#include "CorpusCuerpo.h"
#include "CorpusInterfaz.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "Widgets/SWeakWidget.h"

// ───────── Cámara orbital ─────────
// El atlas mira hacia +Y de Unreal (glTF +Z) con la cabeza en +Z; la vista anterior coloca la cámara delante (Yaw −90).

ACorpusCamara::ACorpusCamara()
{
	PrimaryActorTick.bCanEverTick = true;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Raiz")));
	Camara = CreateDefaultSubobject<UCameraComponent>(TEXT("Camara"));
	Camara->SetupAttachment(RootComponent);
	Camara->SetFieldOfView(30.f); // teleobjetivo suave, como la web: menos deformación de perspectiva
	Camara->bConstrainAspectRatio = false;
}

void ACorpusCamara::Tick(float Dt)
{
	Super::Tick(Dt);
	const float K = 1.f - FMath::Exp(-12.f * Dt);
	ObjetivoSuave = FMath::Lerp(ObjetivoSuave, Objetivo, K);
	DistanciaSuave = FMath::Lerp(DistanciaSuave, Distancia, K);
	YawSuave += FMath::FindDeltaAngleDegrees(YawSuave, Yaw) * K;
	PitchSuave = FMath::Lerp(PitchSuave, Pitch, K);
	const FRotator R(PitchSuave, YawSuave, 0.f);
	SetActorLocationAndRotation(ObjetivoSuave - R.Vector() * DistanciaSuave, R);
}

void ACorpusCamara::Girar(float DYaw, float DPitch)
{
	Yaw = FRotator::NormalizeAxis(Yaw + DYaw);
	Pitch = FMath::Clamp(Pitch + DPitch, -89.f, 89.f);
}

void ACorpusCamara::Desplazar(float DX, float DY)
{
	const FRotator R(PitchSuave, YawSuave, 0.f);
	const float Escala = Distancia * 0.0011f;
	Objetivo += (FRotationMatrix(R).GetUnitAxis(EAxis::Y) * -DX + FRotationMatrix(R).GetUnitAxis(EAxis::Z) * DY) * Escala;
}

void ACorpusCamara::Acercar(float Factor)
{
	Distancia = FMath::Clamp(Distancia * Factor, 6.f, 1500.f);
}

void ACorpusCamara::Encuadrar(const FBox& Caja, bool bInmediato)
{
	if (!Caja.IsValid) { return; }
	Objetivo = Caja.GetCenter();
	const float Radio = FMath::Max(Caja.GetExtent().Size(), 1.f);
	Distancia = FMath::Clamp(Radio / FMath::Tan(FMath::DegreesToRadians(Camara->FieldOfView * 0.5f)) * 1.15f, 6.f, 1500.f);
	if (bInmediato) { ObjetivoSuave = Objetivo; DistanciaSuave = Distancia; }
}

void ACorpusCamara::Vista(int32 Cual)
{
	static const float Y[] = { -90.f, 90.f, 180.f, 0.f, -90.f, -90.f };
	static const float P[] = { 0.f, 0.f, 0.f, 0.f, -89.f, 89.f };
	if (Cual >= 0 && Cual < 6) { Yaw = Y[Cual]; Pitch = P[Cual]; }
}

// ───────── Control ─────────

ACorpusJugador::ACorpusJugador()
{
	bShowMouseCursor = true;
	bEnableClickEvents = false;
	PrimaryActorTick.bCanEverTick = true;
}

void ACorpusJugador::BeginPlay()
{
	Super::BeginPlay();
	FInputModeGameAndUI Modo;
	Modo.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	Modo.SetHideCursorDuringCapture(false);
	SetInputMode(Modo);

	// El cuerpo: el del mapa si lo hay; si no, se crea en el origen.
	for (TActorIterator<ACorpusCuerpo> It(GetWorld()); It; ++It) { CuerpoRef = *It; break; }
	if (!CuerpoRef.IsValid()) { CuerpoRef = GetWorld()->SpawnActor<ACorpusCuerpo>(FVector::ZeroVector, FRotator::ZeroRotator); }
	if (ACorpusCamara* C = CamaraOrbital())
	{
		const FBox B = CuerpoRef->Caja(FString());
		if (B.IsValid) { C->Encuadrar(B, true); }
	}
}

void ACorpusJugador::EncuadrarSeleccion()
{
	ACorpusCamara* C = CamaraOrbital();
	if (!C || !CuerpoRef.IsValid()) { return; }
	C->Encuadrar(CuerpoRef->Caja(CuerpoRef->Seleccionada()));
}

void ACorpusJugador::PlayerTick(float Dt)
{
	Super::PlayerTick(Dt);
	ACorpusCamara* C = CamaraOrbital();
	FVector2D Raton;
	if (!C || !GetMousePosition(Raton.X, Raton.Y)) { bRatonValido = false; return; }
	const FVector2D D = bRatonValido ? Raton - RatonAntes : FVector2D::ZeroVector;
	RatonAntes = Raton; bRatonValido = true;

	const bool bIzq = IsInputKeyDown(EKeys::LeftMouseButton), bDer = IsInputKeyDown(EKeys::RightMouseButton), bMed = IsInputKeyDown(EKeys::MiddleMouseButton);
	if (WasInputKeyJustPressed(EKeys::LeftMouseButton)) { RatonAlPulsar = Raton; }

	// Igual que la web: arrastrar gira, botón derecho o central desplaza, rueda acerca.
	if (bIzq && !IsInputKeyDown(EKeys::LeftShift)) { C->Girar(D.X * 0.35f, -D.Y * 0.35f); }
	else if (bDer || bMed || (bIzq && IsInputKeyDown(EKeys::LeftShift))) { C->Desplazar(D.X, D.Y); }
	if (WasInputKeyJustPressed(EKeys::MouseScrollUp)) { C->Acercar(0.88f); }
	if (WasInputKeyJustPressed(EKeys::MouseScrollDown)) { C->Acercar(1.0f / 0.88f); }

	// Clic sin arrastrar: seleccionar la estructura bajo el cursor. Doble clic: encuadrarla.
	if (WasInputKeyJustReleased(EKeys::LeftMouseButton) && FVector2D::Distance(Raton, RatonAlPulsar) < 5.f && CuerpoRef.IsValid())
	{
		FHitResult Toque;
		const bool bHay = GetHitResultUnderCursor(ECC_Visibility, /*bTraceComplex*/ true, Toque);
		const FString Id = bHay ? CuerpoRef->IdDe(Toque.GetComponent()) : FString();
		const double Ahora = GetWorld()->GetTimeSeconds();
		const bool bDoble = !Id.IsEmpty() && Id == CuerpoRef->Seleccionada() && Ahora - TiempoUltimoClic < 0.35;
		TiempoUltimoClic = Ahora;
		CuerpoRef->Seleccionar(Id);
		if (bDoble) { EncuadrarSeleccion(); }
	}

	// Teclado: F encuadra, H oculta, I aísla, Esc muestra todo, 1–6 vistas fijas.
	if (WasInputKeyJustPressed(EKeys::F)) { EncuadrarSeleccion(); }
	if (CuerpoRef.IsValid() && !CuerpoRef->Seleccionada().IsEmpty())
	{
		if (WasInputKeyJustPressed(EKeys::H)) { CuerpoRef->Ocultar(CuerpoRef->Seleccionada()); }
		if (WasInputKeyJustPressed(EKeys::I)) { CuerpoRef->Aislar(CuerpoRef->Seleccionada()); }
	}
	if (WasInputKeyJustPressed(EKeys::Escape) && CuerpoRef.IsValid()) { CuerpoRef->MostrarTodo(); }
	static const FKey Numeros[] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five, EKeys::Six };
	for (int32 i = 0; i < 6; ++i) { if (WasInputKeyJustPressed(Numeros[i])) { C->Vista(i); } }
}

// ───────── Interfaz y modo de juego ─────────

void ACorpusHUD::BeginPlay()
{
	Super::BeginPlay();
	ACorpusJugador* J = Cast<ACorpusJugador>(GetOwningPlayerController());
	if (!J || !GEngine || !GEngine->GameViewport) { return; }
	Interfaz = SNew(SCorpusInterfaz).Jugador(J);
	GEngine->GameViewport->AddViewportWidgetContent(SNew(SWeakWidget).PossiblyNullContent(Interfaz.ToSharedRef()), 10);
}

void ACorpusHUD::EndPlay(const EEndPlayReason::Type Motivo)
{
	if (Interfaz.IsValid() && GEngine && GEngine->GameViewport) { GEngine->GameViewport->RemoveAllViewportWidgets(); }
	Interfaz.Reset();
	Super::EndPlay(Motivo);
}

ACorpusModoJuego::ACorpusModoJuego()
{
	DefaultPawnClass = ACorpusCamara::StaticClass();
	PlayerControllerClass = ACorpusJugador::StaticClass();
	HUDClass = ACorpusHUD::StaticClass();
}
