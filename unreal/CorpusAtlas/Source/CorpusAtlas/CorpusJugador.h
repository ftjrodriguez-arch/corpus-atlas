// Corpus Atlas (edición Unreal) — cámara orbital y control con ratón (girar, desplazar, acercar, seleccionar).
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "CorpusJugador.generated.h"

class UCameraComponent;
class ACorpusCuerpo;

UCLASS()
class CORPUSATLAS_API ACorpusCamara : public APawn
{
	GENERATED_BODY()
public:
	ACorpusCamara();
	virtual void Tick(float Dt) override;

	void Girar(float DYaw, float DPitch);
	void Desplazar(float DX, float DY);
	void Acercar(float Factor);
	/** Encuadra una caja del mundo (una pieza o el cuerpo entero). */
	void Encuadrar(const FBox& Caja, bool bInmediato = false);
	/** Vistas fijas: 0 anterior, 1 posterior, 2 derecha, 3 izquierda, 4 superior, 5 inferior. */
	void Vista(int32 Cual);

	UPROPERTY(VisibleAnywhere, Category = "Corpus") TObjectPtr<UCameraComponent> Camara;

private:
	FVector Objetivo = FVector(0, 0, 95), ObjetivoSuave = FVector(0, 0, 95);
	float Distancia = 420.f, DistanciaSuave = 420.f;
	float Yaw = -90.f, Pitch = -5.f, YawSuave = -90.f, PitchSuave = -5.f;
};

UCLASS()
class CORPUSATLAS_API ACorpusJugador : public APlayerController
{
	GENERATED_BODY()
public:
	ACorpusJugador();
	virtual void BeginPlay() override;
	virtual void PlayerTick(float Dt) override;

	ACorpusCuerpo* Cuerpo() const { return CuerpoRef.Get(); }
	ACorpusCamara* CamaraOrbital() const { return Cast<ACorpusCamara>(GetPawn()); }
	void EncuadrarSeleccion();

private:
	// Pruebas automáticas (como ?qa en la web): -QaPasos="sel n1394; foto ficha; buscar biceps; foto buscador"
	void TickQa();
	TArray<FString> QaPasos;
	int32 QaIndice = -1;
	double QaHasta = 0;

	TWeakObjectPtr<ACorpusCuerpo> CuerpoRef;
	FVector2D RatonAntes = FVector2D::ZeroVector, RatonAlPulsar = FVector2D::ZeroVector;
	bool bRatonValido = false;
	double TiempoUltimoClic = 0;
};

UCLASS()
class CORPUSATLAS_API ACorpusHUD : public AHUD
{
	GENERATED_BODY()
public:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Motivo) override;
	TSharedPtr<class SWidget> InterfazWidget() const { return Interfaz; }
private:
	TSharedPtr<class SWidget> Interfaz;
};

UCLASS()
class CORPUSATLAS_API ACorpusModoJuego : public AGameModeBase
{
	GENERATED_BODY()
public:
	ACorpusModoJuego();
};
