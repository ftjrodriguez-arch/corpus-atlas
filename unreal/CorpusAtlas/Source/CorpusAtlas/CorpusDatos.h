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

private:
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
	TMap<FString, TSharedPtr<FJsonObject>> UiTr, NombresTr; // por idioma: texto español → traducción
};
