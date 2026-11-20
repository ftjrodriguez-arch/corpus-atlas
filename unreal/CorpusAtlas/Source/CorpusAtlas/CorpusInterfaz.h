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

private:
	ACorpusCuerpo* Cuerpo() const;
	UCorpusDatos* Datos() const;
	void Reconstruir();
	void RehacerCapas();
	void RehacerFicha();
	void RehacerResultados(const FText& Texto);
	TSharedRef<SWidget> Boton(const FString& Texto, TFunction<void()> Accion, bool bAcento = false) const;

	TWeakObjectPtr<ACorpusJugador> Jugador;
	TSharedPtr<SVerticalBox> CajaCapas, CajaFicha, CajaResultados, CajaBarra;
	TSharedPtr<SEditableTextBox> Buscador;
	FDelegateHandle HSel, HCapas, HIdioma;
};
