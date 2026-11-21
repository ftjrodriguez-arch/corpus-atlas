// Corpus Atlas (edición Unreal) — interfaz en Slate: capas, buscador, ficha de la estructura, idioma y cuerpo.
#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "UObject/StrongObjectPtr.h"
#include "Engine/Texture2D.h"
#include "Styling/SlateBrush.h"

class ACorpusJugador;
class ACorpusCuerpo;
class UCorpusDatos;
class SVerticalBox;
class SEditableTextBox;

class SCorpusInterfaz : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SCorpusInterfaz) {}
		SLATE_ARGUMENT(TWeakObjectPtr<ACorpusJugador>, Jugador)
	SLATE_END_ARGS()

	void Construct(const FArguments& Args);
	virtual ~SCorpusInterfaz();

	/** Pruebas automáticas: escribe en el buscador como si lo hiciera el usuario. */
	void QaBuscar(const FString& Texto);
	/** Pruebas automáticas del panel de estudio: «<módulo> [grupo] [entrada] [paso]», «<módulo> buscar <texto>», «responder <pregunta> <opción>»; vacío = cerrar. */
	void QaEstudio(const FString& Args);

private:
	ACorpusCuerpo* Cuerpo() const;
	UCorpusDatos* Datos() const;
	void Reconstruir();
	void RehacerCapas();
	void RehacerFicha();
	void RehacerResultados(const FText& Texto);
	/** Panel de movimiento (rango articular): articulación, movimiento, lado, grados y reproducir. */
	void RehacerMovimiento();
	void AlCambiarPostura();
	/** Panel de estudio: módulos → grupos → entradas → ficha con pasos, imagen y preguntas. */
	void RehacerEstudio();
	void AbrirEstudio(bool bSi);
	/** Enseña en el modelo la entrada (o el paso) que se está leyendo. */
	void EnsenarEstudio();
	const struct FCorpusItemEstudio* ItemEstudio() const;
	TSharedRef<SWidget> Boton(const FString& Texto, TFunction<void()> Accion, bool bAcento = false) const;

	TWeakObjectPtr<ACorpusJugador> Jugador;
	TSharedPtr<SVerticalBox> CajaCapas, CajaFicha, CajaResultados, CajaBarra, CajaMov;
	TSharedPtr<SEditableTextBox> Buscador;
	FDelegateHandle HSel, HCapas, HIdioma, HPostura;
	bool bVerMov = false;
	TSharedPtr<SVerticalBox> CajaEst, CajaEstCab;
	TSharedPtr<class SScrollBox> RolloEst;
	bool bVerEst = false;
	int32 EstMod = 0, EstGrupo = -1, EstItem = -1, EstPaso = 0;
	FString EstFiltro;
	TMap<int32, int32> EstResp;                 // pregunta → opción elegida
	TStrongObjectPtr<UTexture2D> EstTex;        // ilustración de la entrada abierta
	TSharedPtr<FSlateBrush> EstPincel;
	FString EstImg;
	FIntVector MovPintado = FIntVector(-2, -2, -2);   // rango, movimiento y lado con los que se pintó el panel
	uint8 CuerpoPintado = 255;   // la barra (hombre / mujer / Visible Human) se rehace cuando cambia el cuerpo
};
