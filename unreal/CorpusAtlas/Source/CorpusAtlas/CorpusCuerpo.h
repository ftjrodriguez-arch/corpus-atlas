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
	/** Deja a la vista solo esas piezas (de las capas encendidas). Lista vacía = todas. Lo usan las pruebas y lo usarán las lecciones. */
	void VerSolo(const TArray<FString>& Ids);

	// ── Estudio: lecciones, recorridos, casos y patologías enseñan estructuras en el modelo ──
	/** Ids (en el cuerpo actual) de las estructuras con esos nombres en inglés; Lado «d» o «i» deja solo ese lado en las pares. */
	TArray<FString> IdsDeNombres(const TArray<FString>& En, const FString& Lado = FString()) const;
	/** Enseña solo esas piezas: enciende sus capas (y las de Capas) y oculta lo demás. Sin piezas, solo enciende las capas. */
	void Ensenar(const TArray<FString>& Ids, const TArray<FString>& Capas);
	/** Recorridos: capas, opacidades, piezas aisladas y ocultas como en ese paso de la web. */
	void PonerVista(const struct FCorpusVistaPaso& V);
	/** Guarda y devuelve cuerpo, capas y opacidades (al entrar y al salir del panel de estudio). */
	void GuardarEstado();
	void RestaurarEstado();

	/** Id de la pieza a la que pertenece un componente (clic del ratón). */
	FString IdDe(const UPrimitiveComponent* Comp) const;
	/** Caja en el mundo de una pieza, o de todo lo visible si Id está vacío. */
	FBox Caja(const FString& Id) const;

	/** Punto del mundo (cm) de una posición de reposo en glTF (m): relieves óseos, marcas. No sigue a la postura. */
	FVector PuntoMundo(const FVector3f& Gltf) const { return GetActorTransform().TransformPosition(FVector(Gltf.X, Gltf.Z, Gltf.Y) * 100.0); }

	/** Color de estado por pieza (datos primitivos 0–3: rgb + fuerza). La marcha, la sentadilla y los ejercicios lo usarán para la actividad muscular. */
	void PonerEstado(const FString& Id, const FLinearColor& Color, float Fuerza);

	DECLARE_MULTICAST_DELEGATE(FAlCambiar);
	FAlCambiar AlCambiarSeleccion, AlCambiarCapas, AlCambiarPostura;
	/** Herramientas de disección (corte, fantasma, pelar capas, mapa de inserciones): cambió algo que la interfaz pinta. */
	FAlCambiar AlCambiarHerramientas;

	// ── Movimiento: rangos articulares de la web (la GPU deforma las mallas con la textura de postura) ──
	/** Hay pesos y posturas (movimiento.json) y el cuerpo actual se mueve (el Visible Human no). */
	bool MovimientoDisponible() const;
	/** Coloca la postura del movimiento Mov del rango Rango a Grados (lado izquierdo si bIzq). Rango < 0 = reposo. */
	void PonerRango(int32 Rango, int32 Mov, bool bIzq, float Grados);
	void QuitarPostura() { PonerRango(-1, 0, false, 0.f); }
	/** Ida y vuelta entre 0 y el máximo con arranque y frenado suaves; empieza desde el ángulo en que esté. */
	void Reproducir(bool bSi);
	bool Reproduciendo() const { return bReproduciendo; }
	int32 Rango() const { return RangoActual; }
	int32 Movimiento() const { return MovActual; }
	bool LadoIzquierdo() const { return bLadoIzq; }
	float Grados() const { return GradosActual; }
	float GradosMax() const;

	// ── Marcha: instantes del ciclo de la web, con la pelvis, el centro de masas y el pie en el suelo ──
	/** Coloca el instante Ciclo (0–100 %) del patrón de marcha. Patron < 0 = salir de la marcha. */
	void PonerMarcha(int32 Patron, float Ciclo);
	void ReproducirMarcha(bool bSi) { bMarchaEnCurso = bSi && PatronActual >= 0; AlCambiarPostura.Broadcast(); }
	bool MarchaEnCurso() const { return bMarchaEnCurso; }
	void MarchaLenta(bool bSi) { bMarchaLenta = bSi; AlCambiarPostura.Broadcast(); }
	bool EsMarchaLenta() const { return bMarchaLenta; }
	int32 PatronMarcha() const { return PatronActual; }
	float CicloDeMarcha() const { return CicloMarcha; }
	int32 FaseDeMarcha() const;
	/** Intensidad (0–1) de un grupo muscular de la marcha en este instante (miembro derecho, o izquierdo medio ciclo después). */
	float NivelDeGrupo(int32 Gi, bool bIzq = false) const;
	/** Tipo de contracción del grupo en este instante en el miembro derecho: «exc», «con», «iso» o vacío si descansa. */
	FString TipoDeGrupo(int32 Gi) const;
	static FLinearColor ColorDeNivel(float Nivel);
	/** Misma escala amarillo → magenta con la intensidad 0–1 tal cual (ejercicios). */
	static FLinearColor ColorDeIntensidad(float Nivel);
	bool HayPostura() const { return RangoActual >= 0 || PatronActual >= 0 || EjActual >= 0; }

	// ── Ejercicios (sentadilla…): ciclo horneado desde la web con la raíz del cuerpo (pies en el suelo), fases y músculos ──
	/** Coloca el instante Ciclo (0–100 %) de la variante Variante del ejercicio Ej. Ej < 0 = salir del ejercicio. */
	void PonerEjercicio(int32 Ej, int32 Variante, float Ciclo);
	void ReproducirEjercicio(bool bSi) { bEjEnCurso = bSi && EjActual >= 0; AlCambiarPostura.Broadcast(); }
	bool EjercicioEnCurso() const { return bEjEnCurso; }
	void EjercicioLento(bool bSi) { bEjLento = bSi; AlCambiarPostura.Broadcast(); }
	bool EsEjercicioLento() const { return bEjLento; }
	int32 Ejercicio() const { return EjActual; }
	int32 VarianteDeEjercicio() const { return VarEj; }
	float CicloDeEjercicio() const { return CicloEj; }
	/** Fase del ciclo en este instante (índice en Fases), o -1. */
	int32 FaseDeEjercicio() const;
	/** Intensidad (0–1) de un grupo muscular del ejercicio en este instante. */
	float NivelDeGrupoEj(int32 Gi) const;
	/** Ángulos que enseña el ejercicio en este instante (cadera, rodilla…), interpolados. */
	TArray<float> MedidasDeEjercicio() const;

	virtual void Tick(float Dt) override;

	// ── Plano de corte en vivo (colección de parámetros MPC_Corte, leída por los dos materiales maestros) ──
	/** Eje: 0 sagital, 1 coronal, 2 axial; otro valor lo apaga. Pos: 0–1 a lo ancho, fondo o alto de lo que se ve. */
	void PonerCorte(int32 Eje, float Pos);
	void QuitarCorte() { PonerCorte(-1, 0.5f); }
	/** Enseña la otra mitad. */
	void InvertirCorte() { bCorteInv = !bCorteInv; PonerCorte(EjeDeCorte, PosDeCorte); }
	int32 EjeCorte() const { return EjeDeCorte; }
	float PosCorte() const { return PosDeCorte; }
	bool CorteInvertido() const { return bCorteInv; }
	/** ¿Ese punto del mundo está en la mitad que el corte ha quitado? (el clic del ratón la atraviesa) */
	bool Cortado(const FVector& Punto) const;

	// ── Fantasma: translúcidas todas las capas menos la de la pieza seleccionada (sin selección, menos los huesos) ──
	void Fantasma(bool bSi);
	bool EnFantasma() const { return bFantasma; }
	// ── Pelar capas: ocultar los músculos por profundidad (data/extras.json → dep: «s», «i», «p»), como DEPTH_OFF en la web ──
	void PelarProfundidad(const FString& Prof, bool bOcultar);
	bool ProfundidadOculta(const FString& Prof) const { return ProfOcultas.Contains(Prof); }

	// ── Mapa de origen (rojo) e inserción (azul): las áreas de la capa «insercion» del hueso o músculo seleccionado ──
	/** Enciende las áreas del hueso seleccionado (todas las que tiene dibujadas encima) o del músculo seleccionado (las suyas),
	    coloreadas por su papel, y deja translúcido lo que tapa el hueso. Con false las apaga. */
	void MapaInserciones(bool bSi);
	bool EnMapaInserciones() const { return bMapa; }
	const TSet<FString>& AreasDelMapa() const { return IdsMapa; }
	/** ¿La pieza (hueso o músculo) tiene áreas de origen o inserción en el cuerpo actual? */
	bool TieneInserciones(const FString& Id) const;
	static FLinearColor ColorOrigen() { return FLinearColor(FColor::FromHex(TEXT("d01818"))); }
	static FLinearColor ColorInsercion() { return FLinearColor(FColor::FromHex(TEXT("1f55e0"))); }

private:
	bool bMapa = false, bFantasmaPorMapa = false;
	TSet<FString> IdsMapa;
	TArray<FString> AreasDe(const FString& Id) const;
	bool bFantasma = false;
	TMap<FString, float> OpacidadesFantasma;   // opacidad que tenía cada capa antes de volverla fantasma
	TSet<FString> ProfOcultas;
	void FantasmaCapas(const TSet<FString>& Solidas);

	int32 EjeDeCorte = -1;
	float PosDeCorte = 0.5f;
	bool bCorteInv = false, bCorteInvPintado = false;
	FVector4 PlanoCorte = FVector4(1, 0, 0, 0);
	UPROPERTY() TObjectPtr<class UMaterialParameterCollection> ColeccionCorte;

	void CrearTexturaPostura();
	void PosturaEnReposo();
	void MezclarFotogramas(const TArray<float>& F0, const TArray<float>& F1, float A);
	int32 PatronActual = -1;
	float CicloMarcha = 0.f;
	bool bMarchaEnCurso = false, bMarchaLenta = false;
	FTransform TransformBase = FTransform::Identity;
	TSet<FString> IdsMarcha;
	TMap<FString, FIntPoint> GruposMarcha;      // pieza → (grupo muscular, 0 derecho / 1 izquierdo)
	TMap<FString, FLinearColor> FijosMarcha;    // músculos débiles o espásticos del patrón
	int32 EjActual = -1, VarEj = 0;
	float CicloEj = 0.f;
	bool bEjEnCurso = false, bEjLento = false;
	TMap<FString, int32> GruposEj;              // pieza → grupo muscular del ejercicio
	void SubirPostura();
	void AjustarLimites(UStaticMeshComponent* C) const;
	void PintarAgonistas(const TArray<FString>& En, const FString& Lado);
	TArray<FVector4f> Postura;                        // ancho × 4: eje+ángulo, pivote, traslación (glTF, m)
	int32 AnchoPostura = 32, AltoPostura = 4;
	UPROPERTY() TObjectPtr<class UTexture2D> TexPostura;
	// Correctivos elásticos del hombro: la rejilla de cada músculo en una textura (mitad superior: desplazamiento de cada
	// nodo; mitad inferior: su giro). El texel 0 dice si están activos y en qué fila empiezan los giros.
	void CrearTexturaCorrectivo();
	void PonerCorrectivo(const struct FCorpusRango* R, int32 Mov, bool bIzq, int32 I0, int32 I1, float A);
	void SubirCorrectivo();
	TArray<FVector4f> Correctivo;
	int32 AnchoCorr = 4, FilasCorr = 1;
	bool bCorrActivo = false;
	FString ClaveCorr;
	UPROPERTY() TObjectPtr<class UTexture2D> TexCorrectivo;
	TSet<FString> IdsAgonistas;
	int32 RangoActual = -1, MovActual = 0;
	bool bLadoIzq = false, bReproduciendo = false;
	float GradosActual = 0.f, SentidoRepro = 1.f;
	float FaseRepro = 0.f;   // 0–1 del recorrido de ida; el ángulo es máx · (1 − cos(π·fase)) / 2

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
	TSet<FString> Grupo;
	ECorpusCuerpo CuerpoActual = ECorpusCuerpo::Hombre;
	// estado guardado al entrar en el panel de estudio
	bool bHayGuardado = false;
	ECorpusCuerpo CuerpoGuardado = ECorpusCuerpo::Hombre;
	TSet<FString> CapasGuardadas;
	TMap<FString, float> OpacidadesGuardadas;
	/** Capa (clave) en la que está la pieza en el cuerpo actual, o vacío si no existe en él. */
	FString CapaDePieza(const struct FCorpusPieza& P) const;
};
