// Corpus Atlas (edición Unreal) — interfaz en Slate: capas, buscador, ficha de la estructura, idioma y cuerpo.
#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"

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
	TSharedRef<SWidget> Boton(const FString& Texto, TFunction<void()> Accion, bool bAcento = false) const;

	TWeakObjectPtr<ACorpusJugador> Jugador;
	TSharedPtr<SVerticalBox> CajaCapas, CajaFicha, CajaResultados, CajaBarra, CajaMov;
	TSharedPtr<SEditableTextBox> Buscador;
	FDelegateHandle HSel, HCapas, HIdioma, HPostura;
	bool bVerMov = false;
	FIntVector MovPintado = FIntVector(-2, -2, -2);   // rango, movimiento y lado con los que se pintó el panel
	uint8 CuerpoPintado = 255;   // la barra (hombre / mujer / Visible Human) se rehace cuando cambia el cuerpo
};
