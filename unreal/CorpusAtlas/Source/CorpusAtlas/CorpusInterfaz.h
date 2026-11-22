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

/** Papel de un botón (PLAN_INTERFAZ.md): acción principal del panel (acento con texto oscuro), selección dentro de un
 *  grupo (borde y texto en acento, sin relleno) o normal. */
enum class ECorpusBoton : uint8 { Normal, Principal, Seleccionado };

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
	/** Pruebas automáticas de la interfaz: «panel <0|1>»… Devuelve false si el verbo no es suyo. */
	bool Qa(const FString& Verbo, const FString& Resto);

	/** Esc: cierra lo último abierto, en este orden: resultados del buscador → ficha → Estudiar. False si no había nada. */
	bool CerrarConEsc();
	/** Ctrl+F: el foco del teclado va al buscador. */
	void EnfocarBuscador();
	/** ¿Hay un cuadro de texto con el foco del teclado? (entonces F, H, I y los números no actúan sobre el modelo) */
	static bool Escribiendo();

private:
	ACorpusCuerpo* Cuerpo() const;
	UCorpusDatos* Datos() const;
	void Reconstruir();
	void RehacerCapas();
	/** Barra flotante de disección (abajo, en el centro de la zona libre): aislar, ocultar, fantasma, pelar, corte y restablecer. */
	void RehacerHerramientas();
	/** Botón de la barra de disección: con ayuda (ToolTip) y desactivable. */
	TSharedRef<SWidget> BotonBarra(const FString& Texto, const FString& Ayuda, TFunction<void()> Accion, ECorpusBoton Papel, TAttribute<bool> Activo = true, const FString& AyudaInactivo = FString()) const;
	/** Cruceta de vistas fijas (abajo a la izquierda, sobre el visor). */
	void RehacerVistas();
	TSharedPtr<SVerticalBox> CajaVistas;
	FString AisladaPintada;                     // la barra se rehace si cambia la pieza aislada (también con la tecla I)

	// ── Barra de modos Explorar · Movimiento · Estudiar (arriba a la izquierda) con subrayado que se desliza ──
	/** 0 Explorar · 1 Movimiento · 2 Estudiar. */
	int32 ModoActivo() const;
	void PonerModo(int32 Modo);
	void RehacerModos();
	TSharedPtr<SVerticalBox> CajaModos;
	TSharedPtr<SWidget> FilaModos, Subrayado;
	float ModoPos = 0.f, ModoDesde = 0.f, ModoT = 1.f;   // posición del subrayado (en pestañas), de dónde salió y avance 0–1
	int32 ModoMeta = 0;
	float AnchoPestana = 112.f;                 // ancho medido de cada pestaña (la barra mide ANCHO_IZQ; se lee de la geometría)

	// ── Cabecera del panel izquierdo: idioma y ajustes en menús desplegables ──
	TSharedPtr<class SComboButton> MenuIdioma, MenuAjustes;

	// ── Capas: grupos plegables, opacidad al pasar el ratón ──
	TSet<FString> GruposPlegados;               // nombre del grupo (en español, como en la tabla de capas)
	FString QaOpacidad;                         // pruebas: «verop <clave>» deja a la vista la opacidad de esa fila
	TSharedPtr<class SScrollBox> RolloCapas;

	// ── Plegado automático del panel izquierdo y zona libre para la cámara ──
	bool bPlegadoAuto = false;                  // lo plegó una ficha o Estudiar: se vuelve a abrir al cerrarlos
	bool bAbiertoAMano = false;                 // el usuario lo abrió con la ficha o Estudiar a la vista: no se vuelve a plegar
	void PlegarPanel(bool bPlegar);             // botones « y » (y pruebas «panel»)
	void PlegadoAutomatico();
	/** Le dice a la cámara qué parte del ancho dejan libre los paneles (con su estado de destino, no el animado). */
	void ActualizarZonaLibre();
	/** Borde de la zona libre en unidades de Slate (dentro del escalador), con los paneles animados. bAbajo: lo que llega al pie. */
	float BordeIzq() const;
	float BordeDer(bool bAbajo) const;
	void RehacerFicha();
	void RehacerResultados(const FText& Texto);
	/** Panel de movimiento (rango articular): articulación, movimiento, lado, grados y reproducir. */
	void RehacerMovimiento();
	FIntVector ClaveMov() const;
	bool bEjTecnica = false;   // modo «Ejercicio»: textos de técnica y errores en lugar de la lista de músculos
	void AlCambiarPostura();
	/** Panel de estudio: módulos → grupos → entradas → ficha con pasos, imagen y preguntas. */
	void RehacerEstudio();
	void AbrirEstudio(bool bSi);
	/** Enseña en el modelo la entrada (o el paso) que se está leyendo. */
	void EnsenarEstudio();
	const struct FCorpusItemEstudio* ItemEstudio() const;
	TSharedRef<SWidget> Boton(const FString& Texto, TFunction<void()> Accion, ECorpusBoton Papel = ECorpusBoton::Normal) const;
	/** Atajo: seleccionado si bSel, normal si no (cuerpo, idioma, articulación, lado…). */
	TSharedRef<SWidget> BotonSel(const FString& Texto, TFunction<void()> Accion, bool bSel) const { return Boton(Texto, MoveTemp(Accion), bSel ? ECorpusBoton::Seleccionado : ECorpusBoton::Normal); }

	TWeakObjectPtr<ACorpusJugador> Jugador;
	TSharedPtr<SVerticalBox> CajaCapas, CajaFicha, CajaResultados, CajaBarra, CajaMov, CajaHerr;
	TSharedPtr<SEditableTextBox> Buscador;
	FDelegateHandle HSel, HCapas, HIdioma, HPostura, HHerr;
	bool bVerMov = false;
	// Relieves óseos (extras.json → lm) del hueso seleccionado que se están marcando sobre el modelo
	void VerRelieves(const TArray<int32>& Cuales, bool bEnfocar);
	void ActualizarMarcas();
	TSharedPtr<class SCorpusMarcas> Marcas;
	TArray<int32> RelVistos;
	FString RelHueso;
	bool bFantasmaPorRelieves = false;
	// Vínculo estructura → estudio: entradas del glosario, patologías y lecciones que nombran la pieza seleccionada
	// (campo «show» de estudio_<idioma>.json). X módulo, Y grupo, Z entrada, W paso que la nombra.
	const TArray<FIntVector4>& EnlacesDe(const FString& En);
	void AbrirEnlace(const FIntVector4& E);
	TMap<FString, TArray<FIntVector4>> Enlaces;
	FString EnlacesIdioma;
	TArray<FIntVector4> EnlacesFicha;           // los que muestra la ficha ahora (pruebas: «enlace <n>»)
	bool bPanelPlegado = false;                 // panel izquierdo recogido en un botón
	TSharedPtr<SVerticalBox> CajaMini;
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

	// ── Animación de los paneles: aparecen y se van con un fundido y un pequeño deslizamiento ──
	virtual void Tick(const FGeometry& G, const double Tiempo, const float Dt) override;
	struct FPanelAnim
	{
		TSharedPtr<SWidget> W;          // la caja del panel
		TFunction<bool()> Ver;          // ¿debe estar a la vista?
		FVector2D Desde;                // de dónde llega (px) cuando aparece
		float V = 0.f;                  // 0 oculto · 1 a la vista
	};
	enum { P_IZQ, P_MINI, P_BUSCA, P_MOV, P_FICHA, P_EST, P_BARRA, P_VISTAS, P_NUM };
	FPanelAnim Anim[P_NUM];
	FVector2D TamVista = FVector2D(1600, 900);   // tamaño de la interfaz en unidades de Slate, ya escalada (para que la ficha no pise el panel de movimiento)
	float EscalaAnim = 1.f;          // pruebas: «animlenta 0.05» para fotografiar la transición
	EVisibility VisAnim(int32 i) const;

	// ── Escala de la interfaz: curva por el lado corto de la ventana × «Tamaño del texto» (configuración del usuario) ──
	float EscalaUI = 1.f;            // la que aplica el SDPIScaler (descontada la escala que ya pone el motor)
	int32 TamTexto = 100;            // 90 · 100 · 125 · 150 %
	void PonerTamTexto(int32 Por);
};
