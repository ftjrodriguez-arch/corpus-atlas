// Corpus Atlas (edición Unreal) — el cuerpo: una malla estática (Nanite) por estructura, agrupadas por capas.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CorpusCuerpo.generated.h"

class UStaticMeshComponent;
class UMaterialInterface;
class UCorpusDatos;

UENUM(BlueprintType)
enum class ECorpusCuerpo : uint8 { Hombre, Mujer, VisibleHuman };

UCLASS()
class CORPUSATLAS_API ACorpusCuerpo : public AActor
{
	GENERATED_BODY()
public:
	ACorpusCuerpo();
	virtual void BeginPlay() override;

	UFUNCTION(BlueprintCallable, Category = "Corpus") void PonerCuerpo(ECorpusCuerpo Nuevo);
	UFUNCTION(BlueprintCallable, Category = "Corpus") ECorpusCuerpo Cuerpo() const { return CuerpoActual; }

	/** ¿La capa existe en el cuerpo actual? (sexo) */
	UFUNCTION(BlueprintCallable, Category = "Corpus") bool CapaDisponible(const FString& Clave) const;
	UFUNCTION(BlueprintCallable, Category = "Corpus") void MostrarCapa(const FString& Clave, bool bVisible);
	UFUNCTION(BlueprintCallable, Category = "Corpus") bool CapaVisible(const FString& Clave) const { return CapasVisibles.Contains(Clave); }
	UFUNCTION(BlueprintCallable, Category = "Corpus") void OpacidadCapa(const FString& Clave, float Opacidad);
	UFUNCTION(BlueprintCallable, Category = "Corpus") float OpacidadDeCapa(const FString& Clave) const;

	UFUNCTION(BlueprintCallable, Category = "Corpus") void Seleccionar(const FString& Id);
	UFUNCTION(BlueprintCallable, Category = "Corpus") const FString& Seleccionada() const { return IdSeleccionada; }
	UFUNCTION(BlueprintCallable, Category = "Corpus") void Ocultar(const FString& Id);
	UFUNCTION(BlueprintCallable, Category = "Corpus") void Aislar(const FString& Id);
	UFUNCTION(BlueprintCallable, Category = "Corpus") void MostrarTodo();

	/** Id de la pieza a la que pertenece un componente (clic del ratón). */
	FString IdDe(const UPrimitiveComponent* Comp) const;
	/** Caja en el mundo de una pieza, o de todo lo visible si Id está vacío. */
	FBox Caja(const FString& Id) const;

	/** Color de estado por pieza (datos primitivos 0–3: rgb + fuerza). La marcha, la sentadilla y los ejercicios lo usarán para la actividad muscular. */
	void PonerEstado(const FString& Id, const FLinearColor& Color, float Fuerza);

	DECLARE_MULTICAST_DELEGATE(FAlCambiar);
	FAlCambiar AlCambiarSeleccion, AlCambiarCapas, AlCambiarPostura;

	// ── Movimiento: rangos articulares de la web (la GPU deforma las mallas con la textura de postura) ──
	/** Hay pesos y posturas (movimiento.json) y el cuerpo actual se mueve (el Visible Human no). */
	bool MovimientoDisponible() const;
	/** Coloca la postura del movimiento Mov del rango Rango a Grados (lado izquierdo si bIzq). Rango < 0 = reposo. */
	void PonerRango(int32 Rango, int32 Mov, bool bIzq, float Grados);
	void QuitarPostura() { PonerRango(-1, 0, false, 0.f); }
	void Reproducir(bool bSi) { bReproduciendo = bSi && RangoActual >= 0; AlCambiarPostura.Broadcast(); }
	bool Reproduciendo() const { return bReproduciendo; }
	int32 Rango() const { return RangoActual; }
	int32 Movimiento() const { return MovActual; }
	bool LadoIzquierdo() const { return bLadoIzq; }
	float Grados() const { return GradosActual; }
	float GradosMax() const;

	virtual void Tick(float Dt) override;

private:
	void CrearTexturaPostura();
	void SubirPostura();
	void AjustarLimites(UStaticMeshComponent* C) const;
	void PintarAgonistas(const TArray<FString>& En, const FString& Lado);
	TArray<FVector4f> Postura;                        // ancho × 4: eje+ángulo, pivote, traslación (glTF, m)
	int32 AnchoPostura = 32;
	UPROPERTY() TObjectPtr<class UTexture2D> TexPostura;
	TSet<FString> IdsAgonistas;
	int32 RangoActual = -1, MovActual = 0;
	bool bLadoIzq = false, bReproduciendo = false;
	float GradosActual = 0.f, SentidoRepro = 1.f;

private:
	UCorpusDatos* Datos() const;
	FString CarpetaCuerpo() const;
	void CargarCapa(const FString& Clave);
	void DescargarTodo();
	void AplicarVisibilidad(const FString& Clave);
	UMaterialInterface* MaterialDe(const FString& Base, bool bTranslucido);

	UPROPERTY() TObjectPtr<USceneComponent> Raiz;
	UPROPERTY() TMap<FString, TObjectPtr<UStaticMeshComponent>> Piezas;
	UPROPERTY() TMap<FString, TObjectPtr<UMaterialInterface>> Materiales;   // instancias dinámicas con la textura de postura
	TMap<FString, TArray<FString>> IdsPorCapa;
	TMap<FString, float> Opacidades;
	TSet<FString> CapasCargadas, CapasVisibles, Ocultas;
	FString IdSeleccionada, IdAislada;
	ECorpusCuerpo CuerpoActual = ECorpusCuerpo::Hombre;
};
