#include "CorpusJugador.h"
#include "CorpusCuerpo.h"
#include "CorpusInterfaz.h"
#include "CorpusDatos.h"
#include "Engine/GameInstance.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "Widgets/SWeakWidget.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"
#if WITH_EDITOR
#include "ShaderCompiler.h"
#endif

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
	// las piezas muy pequeñas (un músculo del ojo, un huesecillo) se encuadran con algo de contexto alrededor: 5 cm de radio mínimo
	const float Radio = FMath::Max(Caja.GetExtent().Size(), 5.f);
	// FieldOfView es horizontal: en pantallas apaisadas manda el ángulo vertical, más estrecho
	float Aspecto = 16.f / 9.f;
	if (GEngine && GEngine->GameViewport)
	{
		FVector2D Tam; GEngine->GameViewport->GetViewportSize(Tam);
		if (Tam.X > 1.f && Tam.Y > 1.f) { Aspecto = Tam.X / Tam.Y; }
	}
	const float TanH = FMath::Tan(FMath::DegreesToRadians(Camara->FieldOfView * 0.5f));
	const float TanMin = FMath::Min(TanH, TanH / Aspecto);
	Distancia = FMath::Clamp(Radio / TanMin * 1.05f, 6.f, 1500.f);
	if (bInmediato) { ObjetivoSuave = Objetivo; DistanciaSuave = Distancia; }
}

void ACorpusCamara::Vista(int32 Cual)
{
	static const float Y[] = { -90.f, 90.f, 180.f, 0.f, -90.f, -90.f };
	static const float P[] = { 0.f, 0.f, 0.f, 0.f, -89.f, 89.f };
	if (Cual >= 0 && Cual < 6) { Yaw = Y[Cual]; Pitch = P[Cual]; }
}

void ACorpusCamara::OrbitaWeb(const FVector3f& Tgt, float R, float Th, float Ph)
{
	// glTF (x, y, z) m → Unreal (x, z, y) cm. En la web la cámara está en tgt + r·(sen ph·sen th, cos ph, sen ph·cos th).
	Objetivo = FVector(Tgt.X, Tgt.Z, Tgt.Y) * 100.0;
	Yaw = FMath::RadiansToDegrees(FMath::Atan2(-FMath::Cos(Th), -FMath::Sin(Th)));
	Pitch = FMath::Clamp(FMath::RadiansToDegrees(Ph) - 90.f, -89.f, 89.f);
	// la web tiene 30° de campo vertical; aquí 30° son horizontales: para ver lo mismo de alto, la cámara se aleja por el aspecto
	float Aspecto = 16.f / 9.f;
	if (GEngine && GEngine->GameViewport)
	{
		FVector2D Tam; GEngine->GameViewport->GetViewportSize(Tam);
		if (Tam.X > 1.f && Tam.Y > 1.f) { Aspecto = Tam.X / Tam.Y; }
	}
	Distancia = FMath::Clamp(R * 100.f * FMath::Max(Aspecto, 1.f), 6.f, 1500.f);
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

	FString Qa;
	if (FParse::Value(FCommandLine::Get(), TEXT("QaPasos="), Qa, /*bShouldStopOnSeparator*/ false))
	{
		Qa.ParseIntoArray(QaPasos, TEXT(";"), true);
		QaHasta = FPlatformTime::Seconds() + 4.0;   // deja arrancar la interfaz y el streaming
		UE_LOG(LogTemp, Display, TEXT("CorpusQa: %d pasos"), QaPasos.Num());
	}
}

void ACorpusJugador::TickQa()
{
	if (QaPasos.Num() == 0 || FPlatformTime::Seconds() < QaHasta) { return; }
#if WITH_EDITOR
	// Sin cocinar, los shaders se compilan al vuelo y mientras tanto se pinta con el material por defecto
	if (GShaderCompilingManager && GShaderCompilingManager->GetNumRemainingJobs() > 0) { QaHasta = FPlatformTime::Seconds() + 0.5; return; }
#endif
	if (++QaIndice >= QaPasos.Num()) { QaPasos.Reset(); ConsoleCommand(TEXT("quit")); return; }

	const FString Paso = QaPasos[QaIndice].TrimStartAndEnd();
	FString Verbo = Paso, Resto;
	Paso.Split(TEXT(" "), &Verbo, &Resto);
	Resto.TrimStartAndEndInline();
	double Pausa = 1.5;
	ACorpusCuerpo* Cu = CuerpoRef.Get();
	ACorpusCamara* Ca = CamaraOrbital();
	UE_LOG(LogTemp, Display, TEXT("CorpusQa %d: %s"), QaIndice, *Paso);

	if (Verbo == TEXT("foto"))
	{
		const FString Archivo = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("Capturas") / (Resto.IsEmpty() ? TEXT("qa") : Resto) + TEXT(".png"));
		FScreenshotRequest::RequestScreenshot(Archivo, /*bShowUI*/ true, /*bAddFilenameSuffix*/ false);
		Pausa = 2.0;
	}
	else if (Verbo == TEXT("esperar")) { Pausa = FCString::Atod(*Resto); }
	else if (Verbo == TEXT("sel") && Cu) { Cu->Seleccionar(Resto); }
	else if (Verbo == TEXT("encuadrar")) { EncuadrarSeleccion(); Pausa = 2.0; }
	else if (Verbo == TEXT("enfocar") && Cu && Ca)
	{
		// enfocar n1620,n1673: encuadra esas piezas sin seleccionarlas (para fotos de una región)
		TArray<FString> Ids; Resto.ParseIntoArray(Ids, TEXT(","), true);
		FBox B(ForceInit);
		for (const FString& Id : Ids) { const FBox Bi = Cu->Caja(Id.TrimStartAndEnd()); if (Bi.IsValid) { B += Bi; } }
		Ca->Encuadrar(B); Pausa = 2.0;
	}
	else if (Verbo == TEXT("acercar") && Ca) { Ca->Acercar(FCString::Atof(*Resto)); Pausa = 1.5; }
	else if (Verbo == TEXT("aislar") && Cu) { Cu->Aislar(Resto.IsEmpty() ? Cu->Seleccionada() : Resto); }
	else if (Verbo == TEXT("ocultar") && Cu) { Cu->Ocultar(Resto.IsEmpty() ? Cu->Seleccionada() : Resto); }
	else if (Verbo == TEXT("todo") && Cu) { Cu->MostrarTodo(); }
	else if (Verbo == TEXT("solo") && Cu) { TArray<FString> Ids; Resto.ParseIntoArray(Ids, TEXT(","), true); Cu->VerSolo(Ids); }   // solo n92,n1687 · solo (vacío) = todas
	else if (Verbo == TEXT("vista") && Ca) { Ca->Vista(FCString::Atoi(*Resto)); Pausa = 2.0; }
	else if (Verbo == TEXT("capa") && Cu)
	{
		FString Clave, Valor; Resto.Split(TEXT(" "), &Clave, &Valor);
		Cu->MostrarCapa(Clave.IsEmpty() ? Resto : Clave, Valor != TEXT("0"));
		Pausa = 3.0;   // la capa nueva carga mallas y quizá shaders
	}
	else if (Verbo == TEXT("idioma"))
	{
		if (UCorpusDatos* D = GetGameInstance() ? GetGameInstance()->GetSubsystem<UCorpusDatos>() : nullptr) { D->PonerIdioma(Resto); }
		Pausa = 2.0;
	}
	else if (Verbo == TEXT("opacidad") && Cu)
	{
		FString Clave, Valor; Resto.Split(TEXT(" "), &Clave, &Valor);
		Cu->OpacidadCapa(Clave, FCString::Atof(*Valor));
		Pausa = 3.0;
	}
	else if (Verbo == TEXT("cuerpo") && Cu)
	{
		Cu->PonerCuerpo(Resto == TEXT("mujer") ? ECorpusCuerpo::Mujer : Resto == TEXT("vh") ? ECorpusCuerpo::VisibleHuman : ECorpusCuerpo::Hombre);
		Pausa = 4.0;
	}
	else if (Verbo == TEXT("rom") && Cu)
	{
		// rom <id> <nº de movimiento> <R|L> <grados>   ·   rom (solo) = reposo
		TArray<FString> A; Resto.ParseIntoArrayWS(A);
		int32 Ri = -1;
		if (const UCorpusDatos* D = GetGameInstance() ? GetGameInstance()->GetSubsystem<UCorpusDatos>() : nullptr)
		{
			for (int32 i = 0; A.Num() > 0 && i < D->Rangos().Num(); ++i) { if (D->Rangos()[i].Id == A[0]) { Ri = i; } }
		}
		Cu->PonerRango(Ri, A.Num() > 1 ? FCString::Atoi(*A[1]) : 0, A.Num() > 2 && A[2] == TEXT("L"), A.Num() > 3 ? FCString::Atof(*A[3]) : 0.f);
		Pausa = 2.0;
	}
	else if (Verbo == TEXT("marcha") && Cu)
	{
		// marcha <id del patrón> <% del ciclo>   ·   marcha (solo) = salir
		TArray<FString> A; Resto.ParseIntoArrayWS(A);
		int32 Pi = -1;
		if (const UCorpusDatos* D = GetGameInstance() ? GetGameInstance()->GetSubsystem<UCorpusDatos>() : nullptr)
		{
			for (int32 i = 0; A.Num() > 0 && i < D->PatronesMarcha().Num(); ++i) { if (D->PatronesMarcha()[i].Id == A[0]) { Pi = i; } }
		}
		Cu->ReproducirMarcha(false);
		Cu->PonerMarcha(Pi, A.Num() > 1 ? FCString::Atof(*A[1]) : 0.f);
		Pausa = 2.0;
	}
	else if (Verbo == TEXT("corte") && Cu)
	{
		// corte <sagital|coronal|axial> <posición 0–1|off>   ·   corte invertir   ·   corte off
		TArray<FString> A; Resto.ParseIntoArrayWS(A);
		const FString E = A.Num() > 0 ? A[0] : FString(TEXT("off"));
		const int32 Eje = E.StartsWith(TEXT("sag")) ? 0 : E.StartsWith(TEXT("cor")) ? 1 : E.StartsWith(TEXT("ax")) ? 2 : -1;
		if (E == TEXT("invertir")) { Cu->InvertirCorte(); }
		else if (Eje < 0 || (A.Num() > 1 && A[1] == TEXT("off"))) { Cu->QuitarCorte(); }
		else { Cu->PonerCorte(Eje, A.Num() > 1 ? FCString::Atof(*A[1]) : 0.5f); }
		Pausa = 2.0;
	}
	else if (Verbo == TEXT("buscar"))
	{
		if (ACorpusHUD* H = Cast<ACorpusHUD>(GetHUD()))
		{
			if (TSharedPtr<SWidget> W = H->InterfazWidget()) { StaticCastSharedPtr<SCorpusInterfaz>(W)->QaBuscar(Resto); }
		}
	}
	else if (Verbo == TEXT("estudio"))
	{
		// estudio <módulo> [grupo] [entrada] [paso] · estudio <módulo> buscar <texto> · estudio responder <pregunta> <opción>
		// · estudio bajar <píxeles> · estudio (solo) = cerrar
		if (ACorpusHUD* H = Cast<ACorpusHUD>(GetHUD()))
		{
			if (TSharedPtr<SWidget> W = H->InterfazWidget()) { StaticCastSharedPtr<SCorpusInterfaz>(W)->QaEstudio(Resto); }
		}
		Pausa = 3.0;
	}
	else { ConsoleCommand(Paso); }
	QaHasta = FPlatformTime::Seconds() + Pausa;
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
	TickQa();
	ACorpusCamara* C = CamaraOrbital();
	// al cambiar de cuerpo (hombre, mujer, Visible Human) se vuelve a encuadrar: no miden lo mismo
	if (C && CuerpoRef.IsValid() && (uint8)CuerpoRef->Cuerpo() != CuerpoAntes)
	{
		CuerpoAntes = (uint8)CuerpoRef->Cuerpo();
		const FBox B = CuerpoRef->Caja(FString());
		if (B.IsValid) { C->Encuadrar(B); }
	}
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
		// el rayo atraviesa lo que el plano de corte ha quitado (la colisión sigue entera) hasta dar con algo que se ve
		FHitResult Toque;
		bool bHay = false;
		FVector Origen, Dir;
		if (DeprojectMousePositionToWorld(Origen, Dir))
		{
			const FCollisionQueryParams Par(FName(TEXT("CorpusClic")), /*bTraceComplex*/ true);
			const FVector Hasta = Origen + Dir * 100000.0;
			FVector Desde = Origen;
			for (int32 i = 0; i < 64 && GetWorld()->LineTraceSingleByChannel(Toque, Desde, Hasta, ECC_Visibility, Par); ++i)
			{
				if (!CuerpoRef->Cortado(Toque.ImpactPoint)) { bHay = true; break; }
				Desde = Toque.ImpactPoint + Dir * 0.05;
			}
		}
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
