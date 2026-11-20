// Corpus Atlas (edición Unreal) — datos del atlas: catálogo, capas, fichas e idiomas.
// Lee los mismos JSON que la web (Content/Datos, copiados por tools/unreal/exportar.js + corpus_importar.py).
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Dom/JsonObject.h"
#include "CorpusDatos.generated.h"

/** Dónde está la malla de una pieza en un cuerpo (hombre, mujer o vh). */
USTRUCT(BlueprintType)
struct FCorpusMalla
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Sistema;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") int32 Triangulos = 0;
	/** Color propio del órgano (lineal) y peso de mezcla con el color de la capa en A; A = 0 si usa el de la capa. */
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FLinearColor Tinte = FLinearColor(0, 0, 0, 0);
};

/** Una estructura anatómica del catálogo (data/catalog.json y fem.json). */
USTRUCT(BlueprintType)
struct FCorpusPieza
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Id;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString En;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Es;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString La;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Sistema;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Lado;
	/** Clave = cuerpo («hombre», «mujer», «vh»). */
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") TMap<FString, FCorpusMalla> Mallas;
};

/** Una capa (sistema) del atlas; misma tabla que SYS en la web. */
USTRUCT(BlueprintType)
struct FCorpusCapa
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Clave;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Nombre;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Grupo;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FLinearColor Color = FLinearColor::White;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") bool bActivaAlInicio = false;
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") float Opacidad = 1.f;
	/** "" = ambos sexos, «m», «f» o «vh». */
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Sexo;
	/** Capa de la que toma el material (p. ej. piel_f → piel). */
	UPROPERTY(BlueprintReadOnly, Category = "Corpus") FString Base;
};

/** Un movimiento de la tabla ROM de la web (flexión del hombro…): la postura ya calculada cada Paso grados. */
struct FCorpusMovimiento
{
	FString Nombre;
	float Max = 0.f, Paso = 5.f;
	TArray<FString> Agonistas;                 // nombres en inglés del catálogo (se pintan de naranja, como en la web)
	TArray<TArray<float>> Derecho, Izquierdo;  // por fotograma: [índice, eje xyz, ángulo (rad), traslación xyz] × articulaciones
};

/** Una articulación o región de la tabla ROM (hombro, codo, tronco…). */
struct FCorpusRango
{
	FString Id, Nombre;
	bool bLados = false;
	TArray<FCorpusMovimiento> Movs;
};

/** Correctivo elástico de un músculo (correctivos.json, tools/unreal/correctivos.js): rejilla de nodos alrededor de la pieza.
    El material mueve cada vértice con los 8 nodos de su celda (interpolación trilineal de la posición de reposo). */
struct FCorpusRejilla
{
	int32 Base = 0;                       // primer texel de la rejilla en la textura de correctivos
	FIntVector N = FIntVector::ZeroValue; // nodos por eje
	FVector3f O = FVector3f::ZeroVector;  // esquina de la rejilla (glTF, m)
	float H = 0.f;                        // tamaño de celda (m)
	int32 Act = 0;                        // nodos guardados (los que tocan al músculo y sus vecinos)
	int64 Lista = 0;                      // posición en el .bin de la lista de nodos (uint32: índice en la rejilla completa)
};
/** Un movimiento con correctivos: por pieza, dónde empiezan sus cuadros en el .bin (7 enteros de 16 bits por nodo y cuadro). */
struct FCorpusCorrMov { int32 Cuadros = 0; TMap<FString, int64> Piezas; };

/** Marcha (movimiento.json → marcha): fases del ciclo, grupos musculares con su intensidad y patrones (normal y patológicos). */
struct FCorpusFaseMarcha { float Ini = 0, Fin = 0; FString Nombre, Abrev, Texto; };
struct FCorpusGrupoMarcha
{
	TArray<FString> En; FString Nombre, Texto;
	TArray<FVector2f> Nivel;                 // (porcentaje del ciclo, intensidad 0–1)
	TArray<FVector2f> Tramos;                // tramos del ciclo en los que trabaja (inicio, fin)
	TArray<TPair<float, FString>> Tipo;      // desde qué porcentaje: «exc» excéntrica, «con» concéntrica, «iso» isométrica
};
struct FCorpusPatronMarcha
{
	FString Id, Nombre, Texto;
	TArray<FString> Debiles, Espasticos;
	float Velocidad = 1.f;
	TArray<TArray<float>> Frames, Raiz;   // por instante: giros (como los rangos) y raíz del cuerpo [cuaternión xyzw, posición xyz] en glTF
};

/** Claves que distinguen mayúsculas (como los objetos de JavaScript): en i18n_de, «urinario» y «Urinario» son textos distintos. */
struct FClaveExacta : TDefaultMapKeyFuncs<FString, FString, false>
{
	static FORCEINLINE bool Matches(const FString& A, const FString& B) { return A.Equals(B, ESearchCase::CaseSensitive); }
	static FORCEINLINE uint32 GetKeyHash(const FString& K) { return GetTypeHash(K); }
};
using FTablaTr = TMap<FString, FString, FDefaultSetAllocator, FClaveExacta>;

UCLASS()
class CORPUSATLAS_API UCorpusDatos : public UGameInstanceSubsystem
{
	GENERATED_BODY()
public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Carpeta con los JSON (Content/Datos). */
	static FString CarpetaDatos();

	UFUNCTION(BlueprintCallable, Category = "Corpus") const TArray<FCorpusCapa>& Capas() const { return ListaCapas; }
	const FCorpusCapa* Capa(const FString& Clave) const;
	const FCorpusPieza* Pieza(const FString& Id) const { return Piezas.Find(Id); }
	const TMap<FString, FCorpusPieza>& TodasLasPiezas() const { return Piezas; }
	bool EsSoloHombre(const FString& Id) const { return SoloHombre.Contains(Id); }
	bool EsOcultaPorCorazon(const FString& Id) const { return CorazonOculto.Contains(Id); }

	/** es, en, pt, fr o de. */
	UFUNCTION(BlueprintCallable, Category = "Corpus") void PonerIdioma(const FString& Codigo);
	UFUNCTION(BlueprintCallable, Category = "Corpus") const FString& Idioma() const { return IdiomaActual; }
	/** Texto de interfaz: se busca por el texto español, como TL() en la web. */
	UFUNCTION(BlueprintCallable, Category = "Corpus") FString T(const FString& Es) const;
	UFUNCTION(BlueprintCallable, Category = "Corpus") FString NombrePieza(const FString& Id) const;
	UFUNCTION(BlueprintCallable, Category = "Corpus") FString NombreCapa(const FString& Clave) const;
	FString NombreLado(const FString& Lado) const;

	/** Ficha de la pieza en el idioma actual: pares campo → texto (origen, inserción, inervación, función…). */
	TArray<TPair<FString, FString>> Ficha(const FString& Id);

	/** Busca por nombre (idioma actual, español, inglés o latín), sin tildes ni mayúsculas. */
	UFUNCTION(BlueprintCallable, Category = "Corpus") TArray<FString> Buscar(const FString& Texto, int32 Maximo = 40) const;

	DECLARE_MULTICAST_DELEGATE(FAlCambiarIdioma);
	FAlCambiarIdioma AlCambiarIdioma;

	/** Movimiento (movimiento.json): pivotes en glTF (m), índice del grupo «tronco entero» y rangos articulares. */
	const TArray<FVector3f>& PivotesArticulaciones() const { return Pivotes; }
	const TArray<FCorpusRango>& Rangos() const { return ListaRangos; }
	int32 IndiceGrupoTronco() const { return IndiceTronco; }
	/** Articulaciones que mueven la pieza en ese cuerpo (carpeta «hombre» o «mujer»): códigos para los datos primitivos 12–19. */
	const TArray<float>* HuecosMovimiento(const FString& Carpeta, const FString& Id) const { return Huecos.Find(Carpeta + TEXT("/") + Id); }

	/** Contorno de la parrilla costal: por cada altura, el radio de las costillas en cada sector angular (glTF, m). */
	const TArray<TArray<float>>& ContornoTorax() const { return Torax; }
	/** Punto de inserción (glTF) de una pieza de fibra tensa, o nullptr. */
	const FVector3f* InsercionFibra(const FString& Carpeta, const FString& Id) const { return Insercion.Find(Carpeta + TEXT("/") + Id); }
	/** ¿La pieza se mantiene pegada a la pared torácica al mover el brazo? (dorsal ancho, redondo mayor) */
	bool SePegaAlTorax(const FString& Carpeta, const FString& Id) const { return Abrazo.Contains(Carpeta + TEXT("/") + Id); }

	const TArray<FCorpusFaseMarcha>& FasesMarcha() const { return Fases; }
	const TArray<FCorpusGrupoMarcha>& GruposMarcha() const { return Grupos; }
	const TArray<FCorpusPatronMarcha>& PatronesMarcha() const { return Patrones; }
	float PasoMarcha() const { return PasoCiclo; }

	/** Correctivos elásticos de los músculos del hombro (correctivos.json + correctivos.bin). */
	const FCorpusRejilla* Rejilla(const FString& Carpeta, const FString& Id) const { return Rejillas.Find(Carpeta + TEXT("/") + Id); }
	const FCorpusRejilla* RejillaDe(const FString& Clave) const { return Rejillas.Find(Clave); }
	const FCorpusCorrMov* Correctivo(const FString& Rom, int32 Mov, bool bIzq) const { return CorrMovs.Find(FString::Printf(TEXT("%s/%d/%s"), *Rom, Mov, bIzq ? TEXT("L") : TEXT("R"))); }
	const TArray<uint8>& BinCorrectivos() const { return CorrBin; }
	int32 TexelesCorrectivo() const { return CorrTexeles; }
	int32 AnchoCorrectivo() const { return CorrAncho; }
	float EscalaCorrectivo() const { return CorrEscala; }

private:
	void CargarMovimiento();
	void CargarCorrectivos();
	TMap<FString, FCorpusRejilla> Rejillas;
	TMap<FString, FCorpusCorrMov> CorrMovs;
	TArray<uint8> CorrBin;
	int32 CorrTexeles = 0, CorrAncho = 512;
	float CorrEscala = 20000.f;
	TArray<FCorpusFaseMarcha> Fases;
	TArray<FCorpusGrupoMarcha> Grupos;
	TArray<FCorpusPatronMarcha> Patrones;
	float PasoCiclo = 2.f;
	TArray<TArray<float>> Torax;
	TMap<FString, FVector3f> Insercion;
	TSet<FString> Abrazo;
	TMap<FString, TArray<float>> Huecos;
	TArray<FVector3f> Pivotes;
	TArray<FString> NombresArt;
	TArray<FCorpusRango> ListaRangos;
	int32 IndiceTronco = 0;

	static TSharedPtr<FJsonObject> LeerObjeto(const FString& Archivo);
	static bool LeerLista(const FString& Archivo, TArray<TSharedPtr<FJsonValue>>& Fuera);
	void CargarCatalogo(const FString& Archivo, const FString& Campo);
	void CargarIdioma(const FString& Codigo);
	static FString Plano(const FString& S);

	TMap<FString, FCorpusPieza> Piezas;
	TArray<FCorpusCapa> ListaCapas;
	TSet<FString> SoloHombre, CorazonOculto;
	FString IdiomaActual = TEXT("es");

	TSharedPtr<FJsonObject> InfoEs;                       // info.json: tipo → nombre inglés → ficha
	TMap<FString, TSharedPtr<FJsonObject>> InfoTr;       // info_en/pt/fr/de: «tipo|nombre» → ficha
	TMap<FString, FTablaTr> UiTr, NombresTr;              // por idioma: texto español → traducción
	TMap<FString, TSharedPtr<FJsonObject>> UiAprox;       // el «ui» tal cual lo lee Unreal (sin distinguir mayúsculas): último recurso
};
