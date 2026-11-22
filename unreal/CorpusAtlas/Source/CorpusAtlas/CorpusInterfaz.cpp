#include "CorpusInterfaz.h"
#include "CorpusJugador.h"
#include "CorpusCuerpo.h"
#include "CorpusDatos.h"
#include "Engine/GameInstance.h"
#include "Brushes/SlateRoundedBoxBrush.h"
#include "Styling/CoreStyle.h"
#include "Widgets/SOverlay.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SDPIScaler.h"
#include "Fonts/CompositeFont.h"
#include "Misc/ConfigCacheIni.h"
#include "CoreGlobals.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SSpacer.h"
#include "Widgets/Layout/SWrapBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSlider.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Notifications/SProgressBar.h"
#include "Widgets/SLeafWidget.h"
#include "Framework/Application/SlateApplication.h"
#include "Fonts/FontMeasure.h"
#include "Rendering/DrawElements.h"
#include "Rendering/SlateRenderer.h"
#include "ImageUtils.h"
#include "Misc/Paths.h"

namespace
{
	// FString::ToUpper solo trata ASCII («CIRCULACIóN»); FText usa ICU y respeta tildes y eñes.
	FString Mayus(const FString& S) { return FText::FromString(S).ToUpper().ToString(); }

	// ═════════ Sistema visual (un solo sitio; reglas en unreal/PLAN_INTERFAZ.md) ═════════
	// Ningún color, tamaño de letra ni relleno suelto en el resto del archivo: todo sale de aquí.
	// Los colores son lineales (Slate los pasa a sRGB al pintar); los que el plan da en hexadecimal sRGB van convertidos al lado.

	// ── Paleta ──
	// Vidrio oscuro azulado con borde fino, tinta casi blanca, gris frío para lo secundario y un acento azul clínico.
	const FLinearColor C_PANEL(0.010f, 0.014f, 0.020f, 0.86f);
	const FLinearColor C_PANEL2(0.030f, 0.040f, 0.055f, 1.f);
	const FLinearColor C_BORDE(0.55f, 0.70f, 0.95f, 0.10f);
	const FLinearColor C_TINTA(0.791f, 0.823f, 0.871f);              // #E6EAF0
	const FLinearColor C_GRIS(0.212f, 0.262f, 0.342f);               // #7F8C9E · etiquetas y texto secundario (≈ 5:1 sobre el panel)
	const FLinearColor C_TINTA_OSCURA(0.0033f, 0.0065f, 0.0144f);    // #0B1320 · texto sobre el acento (≈ 7,5:1; el blanco daba 2,46:1)
	const FLinearColor C_ACENTO(0.07f, 0.42f, 0.86f);                // acción principal y selección
	const FLinearColor C_ACENTO_ENCIMA(0.14f, 0.52f, 0.96f), C_ACENTO_PULSADO(0.05f, 0.32f, 0.68f);
	const FLinearColor C_AMBAR(0.871f, 0.352f, 0.051f);              // #F0A040 · medidas, clínica, avisos
	const FLinearColor C_BIEN(0.25f, 0.85f, 0.40f), C_MAL(1.f, 0.40f, 0.35f);   // examen: solo borde e indicación
	const FLinearColor C_BOTON(0.050f, 0.065f, 0.090f, 1.f), C_BOTON_ENCIMA(0.085f, 0.110f, 0.150f, 1.f), C_BOTON_PULSADO(0.030f, 0.040f, 0.055f, 1.f);
	const FLinearColor C_BORDE_BOTON(1.f, 1.f, 1.f, 0.06f), C_BORDE_ENCIMA(0.60f, 0.78f, 1.f, 0.35f);
	const FLinearColor C_FOCO(0.85f, 0.92f, 1.f, 0.95f);             // anillo de foco del teclado
	const FLinearColor C_BARRA(0.212f, 0.262f, 0.342f, 0.55f), C_BARRA_ENCIMA(0.212f, 0.262f, 0.342f, 0.85f);   // deslizadores
	const FLinearColor C_ROLLO(0.212f, 0.262f, 0.342f, 0.50f), C_ROLLO_ENCIMA(0.212f, 0.262f, 0.342f, 0.80f);   // barras de desplazamiento
	const FLinearColor C_MARCA(1.f, 0.651f, 0.074f);                 // #FFD34D · punto de un relieve óseo
	const FLinearColor C_MARCA_LINEA(1.f, 0.651f, 0.074f, 0.75f);
	const FLinearColor C_ROTULO(0.02f, 0.03f, 0.045f, 0.92f);        // fondo de los rótulos sobre el modelo
	const FLinearColor C_SOMBRA_PUNTO(0.f, 0.f, 0.f, 0.8f);
	const FLinearColor C_GONIO_FONDO(0.14f, 0.17f, 0.22f), C_GONIO_ESCALA(0.30f, 0.34f, 0.40f);

	// ── Espaciado (múltiplos de 4) y radios ──
	constexpr float E_1 = 4.f, E_2 = 8.f, E_3 = 12.f, E_4 = 16.f, E_5 = 20.f, E_6 = 24.f;
	constexpr float M_PANTALLA = E_4;     // margen de los paneles al borde de la ventana
	constexpr float R_PANEL = 16.f, R_TARJETA = 10.f, R_BOTON = 8.f;
	const FMargin RELLENO_PANEL(E_5);
	const FMargin RELLENO_BOTON(E_3, E_2);
	constexpr float BOTON_ALTO_MIN = 32.f, BOTON_ANCHO_MIN = 36.f;
	constexpr float HUECO = 6.f;          // entre botones de una fila (InnerSlotPadding)

	// ── Escala tipográfica (pt de Slate) ──
	constexpr float T_GONIO = 32.f, T_TITULO = 18.f, T_SECCION = 13.f, T_CUERPO = 10.5f, T_NOTA = 11.f, T_SECUNDARIO = 10.f, T_ETIQUETA = 9.f;
	constexpr float T_MARCAS = 12.f, T_MARCAS_VARIAS = 10.f, T_BUSCADOR = 12.f, T_MARCA_CORPUS = 22.f;
	enum class EPeso : uint8 { Regular, Media, Negrita };

	const FSlateBrush* Panel() { static const FSlateRoundedBoxBrush B(C_PANEL, R_PANEL, C_BORDE, 1.f); return &B; }
	const FSlateBrush* Panel2() { static const FSlateRoundedBoxBrush B(C_PANEL2, R_BOTON); return &B; }
	const FSlateBrush* Tarjeta() { static const FSlateRoundedBoxBrush B(C_PANEL2, R_TARJETA); return &B; }
	const FSlateBrush* Punto() { static const FSlateRoundedBoxBrush B(FLinearColor::White, 6.f); return &B; }
	const FSlateBrush* Foco() { static const FSlateRoundedBoxBrush B(FLinearColor::Transparent, R_BOTON, C_FOCO, 2.f); return &B; }

	// ── Tipografía: Inter (SIL OFL 1.1) desde Content/Slate/Fuentes; si falta algún archivo, la fuente por defecto ──
	TSharedPtr<const FCompositeFont> FuenteInter()
	{
		static TSharedPtr<FStandaloneCompositeFont> Fuente;
		static bool bProbada = false;
		if (!bProbada)
		{
			bProbada = true;
			const FString Dir = FPaths::ConvertRelativePathToFull(FPaths::ProjectContentDir() / TEXT("Slate/Fuentes"));
			const TPair<FName, const TCHAR*> Pesos[] = { { FName(TEXT("Regular")), TEXT("Inter-Regular.ttf") }, { FName(TEXT("SemiBold")), TEXT("Inter-SemiBold.ttf") }, { FName(TEXT("Bold")), TEXT("Inter-Bold.ttf") } };
			bool bTodas = true;
			for (const auto& P : Pesos) { bTodas &= FPaths::FileExists(Dir / P.Value); }
			if (bTodas)
			{
				Fuente = MakeShared<FStandaloneCompositeFont>();
				for (const auto& P : Pesos) { Fuente->DefaultTypeface.AppendFont(P.Key, Dir / P.Value, EFontHinting::Default, EFontLoadingPolicy::LazyLoad); }
				// lo que Inter no tenga (flechas raras, otros alfabetos) lo pinta la fuente por defecto
				Fuente->FallbackTypeface.Typeface = FCoreStyle::GetDefaultFont()->DefaultTypeface;
				UE_LOG(LogTemp, Display, TEXT("Corpus: tipografía Inter cargada de %s"), *Dir);
			}
			else
			{
				UE_LOG(LogTemp, Warning, TEXT("Corpus: faltan los TTF de Inter en %s; se usa la fuente por defecto"), *Dir);
			}
		}
		return Fuente;
	}

	FSlateFontInfo Letra(float Tam, EPeso Peso = EPeso::Regular)
	{
		const TSharedPtr<const FCompositeFont> Inter = FuenteInter();
		if (Inter.IsValid())
		{
			return FSlateFontInfo(Inter, Tam, Peso == EPeso::Negrita ? FName(TEXT("Bold")) : Peso == EPeso::Media ? FName(TEXT("SemiBold")) : FName(TEXT("Regular")));
		}
		// Roboto por defecto no tiene semi-negrita: «Bold» para los dos pesos fuertes
		return FCoreStyle::GetDefaultFontStyle(Peso == EPeso::Regular ? "Regular" : "Bold", Tam);
	}
	/** Etiqueta en mayúsculas: 9 pt negrita, gris, con algo de espaciado entre letras. */
	FSlateFontInfo LetraEtiqueta() { FSlateFontInfo F = Letra(T_ETIQUETA, EPeso::Negrita); F.LetterSpacing = 60; return F; }

	TSharedRef<STextBlock> Txt(const FString& S, float Tam, const FLinearColor& Col, EPeso Peso = EPeso::Regular)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Letra(Tam, Peso)).ColorAndOpacity(FSlateColor(Col)).AutoWrapText(true);
	}
	/** Texto de una sola línea (botones, nombres de capa): no se parte; si no cabe, termina en «…» y el nombre completo va en el ToolTip. */
	TSharedRef<STextBlock> TxtLinea(const FString& S, float Tam, const FLinearColor& Col, EPeso Peso = EPeso::Regular)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Letra(Tam, Peso)).ColorAndOpacity(FSlateColor(Col))
			.OverflowPolicy(ETextOverflowPolicy::Ellipsis).ToolTipText(FText::FromString(S));
	}
	/** Etiqueta de sección (CAPAS, DISECCIÓN, ESTUDIAR…): el texto se pasa sin poner en mayúsculas. */
	TSharedRef<STextBlock> Etiqueta(const FString& S)
	{
		return SNew(STextBlock).Text(FText::FromString(Mayus(S))).Font(LetraEtiqueta()).ColorAndOpacity(FSlateColor(C_GRIS)).AutoWrapText(true);
	}

	// ── Botones: normal, principal (acento con texto oscuro), seleccionado (borde y texto en acento) y respuestas del examen ──
	const FButtonStyle& EstiloBoton(ECorpusBoton Papel)
	{
		static FButtonStyle Normal, Principal, Sel;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			const auto Llenar = [](FButtonStyle& S, const FLinearColor& N, const FLinearColor& E, const FLinearColor& P, const FLinearColor& Borde, const FLinearColor& BordeEncima, float Grosor)
			{
				S = FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("Button");
				S.SetNormal(FSlateRoundedBoxBrush(N, R_BOTON, Borde, Grosor));
				S.SetHovered(FSlateRoundedBoxBrush(E, R_BOTON, BordeEncima, Grosor));
				S.SetPressed(FSlateRoundedBoxBrush(P, R_BOTON, Borde, Grosor));
				S.SetDisabled(FSlateRoundedBoxBrush(N * FLinearColor(1, 1, 1, 0.4f), R_BOTON));
				S.SetNormalPadding(FMargin(0)); S.SetPressedPadding(FMargin(0, 1, 0, 0));
			};
			Llenar(Normal, C_BOTON, C_BOTON_ENCIMA, C_BOTON_PULSADO, C_BORDE_BOTON, C_BORDE_ENCIMA, 1.f);
			Llenar(Principal, C_ACENTO, C_ACENTO_ENCIMA, C_ACENTO_PULSADO, C_BORDE_ENCIMA, C_FOCO, 1.f);
			Llenar(Sel, C_BOTON, C_BOTON_ENCIMA, C_BOTON_PULSADO, C_ACENTO, C_ACENTO_ENCIMA, 1.5f);
		}
		return Papel == ECorpusBoton::Principal ? Principal : Papel == ECorpusBoton::Seleccionado ? Sel : Normal;
	}
	const FButtonStyle& EstiloRespuesta(bool bBien)
	{
		static FButtonStyle Bien, Mal;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			for (int32 k = 0; k < 2; ++k)
			{
				FButtonStyle& S = k == 0 ? Bien : Mal;
				const FLinearColor& Borde = k == 0 ? C_BIEN : C_MAL;
				S = EstiloBoton(ECorpusBoton::Normal);
				S.SetNormal(FSlateRoundedBoxBrush(C_BOTON, R_BOTON, Borde, 2.f));
				S.SetHovered(FSlateRoundedBoxBrush(C_BOTON_ENCIMA, R_BOTON, Borde, 2.f));
				S.SetPressed(FSlateRoundedBoxBrush(C_BOTON_PULSADO, R_BOTON, Borde, 2.f));
			}
		}
		return bBien ? Bien : Mal;
	}
	FLinearColor ColorTextoBoton(ECorpusBoton Papel) { return Papel == ECorpusBoton::Principal ? C_TINTA_OSCURA : Papel == ECorpusBoton::Seleccionado ? C_ACENTO_ENCIMA : C_TINTA; }

	/** Envuelve un botón con su tamaño mínimo (32 × 36) y el anillo de foco: solo se ve cuando el foco llegó con el teclado. */
	TSharedRef<SWidget> ConFoco(const TSharedRef<SButton>& B)
	{
		const TWeakPtr<SButton> W(B);
		return SNew(SBox).MinDesiredHeight(BOTON_ALTO_MIN).MinDesiredWidth(BOTON_ANCHO_MIN)
		[
			SNew(SOverlay)
			+ SOverlay::Slot()[ B ]
			+ SOverlay::Slot()
			[
				SNew(SImage).Image(Foco())
				.Visibility_Lambda([W]()
				{
					const TSharedPtr<SButton> P = W.Pin();
					const TOptional<EFocusCause> Causa = P.IsValid() ? P->HasAnyUserFocus() : TOptional<EFocusCause>();
					return (Causa.IsSet() && Causa.GetValue() != EFocusCause::Mouse) ? EVisibility::HitTestInvisible : EVisibility::Hidden;
				})
			]
		];
	}

	/** Fila ancha pulsable (resultado del buscador, enlace a Estudiar, entrada de una lista, opción de una pregunta). */
	TSharedRef<SWidget> BotonFila(const TSharedRef<SWidget>& Contenido, TFunction<void()> Accion, const FButtonStyle* Estilo = nullptr)
	{
		return ConFoco(SNew(SButton).ButtonStyle(Estilo ? Estilo : &EstiloBoton(ECorpusBoton::Normal)).ContentPadding(RELLENO_BOTON).HAlign(HAlign_Fill)
			.OnClicked_Lambda([Accion]() { Accion(); return FReply::Handled(); })
			[ Contenido ]);
	}

	// ── Casilla, deslizador, campo de texto y barras de desplazamiento ──
	const FCheckBoxStyle& EstiloCasilla()
	{
		static FCheckBoxStyle S;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			S = FCoreStyle::Get().GetWidgetStyle<FCheckBoxStyle>("Checkbox");   // conserva la marca de verificación del motor
			const FVector2f Lado(18.f, 18.f);
			S.SetBackgroundImage(FSlateRoundedBoxBrush(FLinearColor::Transparent, 4.f, C_GRIS, 1.5f, Lado));
			S.SetBackgroundHoveredImage(FSlateRoundedBoxBrush(C_BOTON_ENCIMA, 4.f, C_TINTA, 1.5f, Lado));
			S.SetBackgroundPressedImage(FSlateRoundedBoxBrush(C_BOTON_PULSADO, 4.f, C_TINTA, 1.5f, Lado));
			S.CheckedImage.TintColor = FSlateColor(C_ACENTO_ENCIMA);
			S.CheckedHoveredImage.TintColor = FSlateColor(C_ACENTO_ENCIMA);
			S.CheckedPressedImage.TintColor = FSlateColor(C_ACENTO);
			S.SetPadding(FMargin(E_2, 0.f, 0.f, 0.f));
		}
		return S;
	}
	const FSliderStyle& EstiloDeslizador()
	{
		static FSliderStyle S;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			S = FCoreStyle::Get().GetWidgetStyle<FSliderStyle>("Slider");
			S.SetNormalBarImage(FSlateRoundedBoxBrush(C_BARRA, 2.f));
			S.SetHoveredBarImage(FSlateRoundedBoxBrush(C_BARRA_ENCIMA, 2.f));
			S.SetDisabledBarImage(FSlateRoundedBoxBrush(C_BARRA * FLinearColor(1, 1, 1, 0.5f), 2.f));
			S.SetNormalThumbImage(FSlateRoundedBoxBrush(C_TINTA, 7.f, FVector2f(14.f, 14.f)));
			S.SetHoveredThumbImage(FSlateRoundedBoxBrush(FLinearColor::White, 7.f, C_ACENTO_ENCIMA, 2.f, FVector2f(14.f, 14.f)));
			S.SetDisabledThumbImage(FSlateRoundedBoxBrush(C_GRIS, 7.f, FVector2f(14.f, 14.f)));
			S.SetBarThickness(4.f);
		}
		return S;
	}
	const FScrollBarStyle& EstiloRollo()
	{
		static FScrollBarStyle S;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			S = FCoreStyle::Get().GetWidgetStyle<FScrollBarStyle>("ScrollBar");
			S.SetVerticalBackgroundImage(FSlateNoResource()).SetHorizontalBackgroundImage(FSlateNoResource());
			S.SetVerticalTopSlotImage(FSlateNoResource()).SetVerticalBottomSlotImage(FSlateNoResource());
			S.SetHorizontalTopSlotImage(FSlateNoResource()).SetHorizontalBottomSlotImage(FSlateNoResource());
			S.SetNormalThumbImage(FSlateRoundedBoxBrush(C_ROLLO, 3.f));
			S.SetHoveredThumbImage(FSlateRoundedBoxBrush(C_ROLLO_ENCIMA, 3.f));
			S.SetDraggedThumbImage(FSlateRoundedBoxBrush(C_ROLLO_ENCIMA, 3.f));
			S.SetThickness(6.f);
		}
		return S;
	}
	const FEditableTextBoxStyle& EstiloCampo()
	{
		static FEditableTextBoxStyle S;
		static bool bListo = false;
		if (!bListo)
		{
			bListo = true;
			S = FCoreStyle::Get().GetWidgetStyle<FEditableTextBoxStyle>("NormalEditableTextBox");
			S.SetBackgroundImageNormal(FSlateRoundedBoxBrush(C_PANEL2, R_BOTON, C_BORDE_BOTON, 1.f));
			S.SetBackgroundImageHovered(FSlateRoundedBoxBrush(C_PANEL2, R_BOTON, C_BORDE_ENCIMA, 1.f));
			S.SetBackgroundImageFocused(FSlateRoundedBoxBrush(C_PANEL2, R_BOTON, C_FOCO, 2.f));
			S.SetBackgroundImageReadOnly(FSlateRoundedBoxBrush(C_PANEL2, R_BOTON));
			S.SetBackgroundColor(FSlateColor(FLinearColor::White));   // el color ya va en los pinceles
			S.SetForegroundColor(FSlateColor(C_TINTA)).SetFocusedForegroundColor(FSlateColor(C_TINTA));   // la ayuda sale de este color con poca opacidad: gris
			S.SetFont(Letra(T_BUSCADOR));
			S.SetPadding(FMargin(E_3, E_2));
			S.SetScrollBarStyle(EstiloRollo());
		}
		return S;
	}
	const FVector2f GROSOR_ROLLO(6.f, 6.f);

	/** Curva de escala por el lado corto de la ventana (px): 720 → 0,9 · 1080 → 1,0 · 1440 → 1,25 · 2160 → 1,6. Fuera, proporcional. */
	float EscalaPorLado(float Lado)
	{
		static const FVector2f P[] = { {720.f, 0.9f}, {1080.f, 1.0f}, {1440.f, 1.25f}, {2160.f, 1.6f} };
		if (Lado <= P[0].X) { return FMath::Max(0.5f, P[0].Y * Lado / P[0].X); }
		for (int32 i = 1; i < (int32)UE_ARRAY_COUNT(P); ++i)
		{
			if (Lado <= P[i].X) { return FMath::Lerp(P[i - 1].Y, P[i].Y, (Lado - P[i - 1].X) / (P[i].X - P[i - 1].X)); }
		}
		return P[3].Y * Lado / P[3].X;
	}
	// Configuración del usuario (GameUserSettings.ini, no se sube a Git): «Tamaño del texto»
	const TCHAR* INI_SECCION = TEXT("CorpusAtlas.Interfaz");
	const TCHAR* INI_TAM_TEXTO = TEXT("TamTexto");
	constexpr float ANCHO_MIN_PANELES = 1320.f;   // capas + buscador + ficha sin pisarse (unidades de Slate)
}

// ───────── Marcas sobre el modelo (relieves óseos) ─────────
// Un punto amarillo sobre cada relieve y su nombre. Con una sola marca, el rótulo va al lado; con varias, los rótulos se
// ordenan en dos columnas a los lados del hueso, unidos a su punto por una línea (como en una lámina de atlas), para que
// no se pisen. Se dibuja en la interfaz, encima del modelo (la web también las pinta sin prueba de profundidad).
class SCorpusMarcas : public SLeafWidget
{
public:
	SLATE_BEGIN_ARGS(SCorpusMarcas) {}
	SLATE_END_ARGS()
	void Construct(const FArguments&) { SetVisibility(EVisibility::HitTestInvisible); }
	virtual FVector2D ComputeDesiredSize(float) const override { return FVector2D::ZeroVector; }

	TWeakObjectPtr<ACorpusJugador> Jugador;
	TArray<TPair<FVector, FString>> Puntos;   // punto del mundo y rótulo
	// Zona libre entre los paneles (unidades de Slate, ya escaladas): la pone SCorpusInterfaz::Tick con la geometría real
	double LimIzq = 360.0, LimDer = 430.0, LimArriba = 74.0;   // borde derecho del panel izquierdo · ancho ocupado a la derecha · bajo el buscador

	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& Recorte, FSlateWindowElementList& Fuera, int32 Capa, const FWidgetStyle& Estilo, bool bActivo) const override
	{
		const ACorpusJugador* J = Jugador.Get();
		const ACorpusCuerpo* Cu = J ? J->Cuerpo() : nullptr;
		int32 VX = 0, VY = 0;
		if (J) { J->GetViewportSize(VX, VY); }
		if (!Cu || Puntos.Num() == 0 || VX < 2 || VY < 2 || Cu->HayPostura()) { return Capa; }   // las marcas son de reposo
		const FVector2D Tam = G.GetLocalSize();
		const FVector2D Esc(Tam.X / VX, Tam.Y / VY);
		const FSlateFontInfo Fuente = Letra(Puntos.Num() == 1 ? T_MARCAS : T_MARCAS_VARIAS, EPeso::Negrita);
		const TSharedRef<FSlateFontMeasure> Medir = FSlateApplication::Get().GetRenderer()->GetFontMeasureService();

		struct FM { FVector2D P, T; FString S; };   // punto, tamaño del texto y texto
		TArray<FM> Ms;
		for (const auto& Par : Puntos)
		{
			FVector2D Px;
			if (!J->ProjectWorldLocationToScreen(Par.Key, Px)) { continue; }
			Ms.Add({ Px * Esc, FVector2D(Medir->Measure(Par.Value, Fuente)), Par.Value });
		}
		if (Ms.Num() == 0) { return Capa; }
		const auto Rotulo = [&](const FM& M, const FVector2D& Pos)   // Pos = esquina superior izquierda del rótulo
		{
			const FVector2D Caja = M.T + FVector2D(E_3, E_2);
			FSlateDrawElement::MakeBox(Fuera, Capa + 1, G.ToPaintGeometry(Caja, FSlateLayoutTransform(Pos)), Panel2(), ESlateDrawEffect::None, C_ROTULO);   // el color pasado sustituye al del pincel
			FSlateDrawElement::MakeText(Fuera, Capa + 2, G.ToPaintGeometry(M.T, FSlateLayoutTransform(Pos + FVector2D(E_3 * 0.5f, E_1))), M.S, Fuente, ESlateDrawEffect::None, C_TINTA);
		};
		const auto Punto8 = [&](const FVector2D& P)
		{
			FSlateDrawElement::MakeBox(Fuera, Capa + 3, G.ToPaintGeometry(FVector2D(12, 12), FSlateLayoutTransform(P - FVector2D(6, 6))), Punto(), ESlateDrawEffect::None, C_SOMBRA_PUNTO);
			FSlateDrawElement::MakeBox(Fuera, Capa + 4, G.ToPaintGeometry(FVector2D(8, 8), FSlateLayoutTransform(P - FVector2D(4, 4))), Punto(), ESlateDrawEffect::None, C_MARCA);
		};
		if (Ms.Num() == 1)
		{
			Punto8(Ms[0].P);
			Rotulo(Ms[0], Ms[0].P + FVector2D(E_4, -Ms[0].T.Y * 0.5 - E_1));
			return Capa + 4;
		}
		// dos columnas: a la izquierda los puntos de la mitad izquierda del hueso en pantalla, a la derecha los demás
		double MinX = Ms[0].P.X, MaxX = Ms[0].P.X;
		TArray<double> Xs;
		for (const FM& M : Ms) { MinX = FMath::Min(MinX, M.P.X); MaxX = FMath::Max(MaxX, M.P.X); Xs.Add(M.P.X); }
		Xs.Sort();
		const double Medio = Xs[Xs.Num() / 2];
		const double Paso = Ms[0].T.Y + 10.0;
		for (int32 Lado = 0; Lado < 2; ++Lado)
		{
			TArray<const FM*> Col;
			for (const FM& M : Ms) { if ((M.P.X < Medio) == (Lado == 0)) { Col.Add(&M); } }
			if (Col.Num() == 0) { continue; }
			Col.Sort([](const FM& A, const FM& B) { return A.P.Y < B.P.Y; });
			// alturas: cada rótulo a la altura de su punto si cabe; si no, debajo del anterior. Luego se centra la columna.
			TArray<double> Ys;
			double Suma = 0, SumaP = 0;
			for (int32 i = 0; i < Col.Num(); ++i) { Ys.Add(i == 0 ? Col[i]->P.Y : FMath::Max(Col[i]->P.Y, Ys[i - 1] + Paso)); Suma += Ys[i]; SumaP += Col[i]->P.Y; }
			double Corr = (SumaP - Suma) / Col.Num();
			Corr = FMath::Clamp(Corr, LimArriba - Ys[0], FMath::Max(LimArriba - Ys[0], Tam.Y - Paso - Ys.Last()));   // por debajo del buscador
			// las columnas no se meten bajo los paneles: el rótulo más ancho de cada columna cabe entero entre el panel y el modelo
			double AnchoCol = 0;
			for (const FM* M : Col) { AnchoCol = FMath::Max(AnchoCol, M->T.X + E_3); }
			const double XCol = Lado == 0 ? FMath::Max(MinX - 70.0, LimIzq + AnchoCol) : FMath::Min(MaxX + 70.0, Tam.X - LimDer - AnchoCol);
			for (int32 i = 0; i < Col.Num(); ++i)
			{
				const FM& M = *Col[i];
				const double Y = Ys[i] + Corr;
				const FVector2D Pos(Lado == 0 ? XCol - M.T.X - E_3 : XCol, Y - M.T.Y * 0.5 - E_1);
				const FVector2D Ancla(XCol, Y);
				FSlateDrawElement::MakeLines(Fuera, Capa, G.ToPaintGeometry(), TArray<FVector2f>({ FVector2f(M.P), FVector2f(Ancla) }), ESlateDrawEffect::None, C_MARCA_LINEA, true, 1.2f);
				Rotulo(M, Pos);
				Punto8(M.P);
			}
		}
		return Capa + 4;
	}
};

// ───────── Goniómetro en pantalla ─────────
// Semicírculo graduado: brazo fijo a 0°, brazo móvil en el ángulo actual, arco recorrido en color y el tope del rango marcado.
class SCorpusGonio : public SLeafWidget
{
public:
	SLATE_BEGIN_ARGS(SCorpusGonio) {}
	SLATE_END_ARGS()
	void Construct(const FArguments&) { SetVisibility(EVisibility::HitTestInvisible); }
	virtual FVector2D ComputeDesiredSize(float) const override { return FVector2D(210.0, 118.0); }
	TWeakObjectPtr<ACorpusCuerpo> Cuerpo;
	mutable float Suave = -1.f;

	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& Recorte, FSlateWindowElementList& Fuera, int32 Capa, const FWidgetStyle& Estilo, bool bActivo) const override
	{
		const ACorpusCuerpo* Cu = Cuerpo.Get();
		if (!Cu || Cu->Rango() < 0) { return Capa; }
		const float Max = FMath::Max(Cu->GradosMax(), 1.f), Meta = FMath::Clamp(Cu->Grados(), 0.f, Max);
		// la aguja sigue al ángulo con un pequeño retardo amortiguado (al saltar con el deslizador no da un salto seco)
		const float Dt = FMath::Min((float)FSlateApplication::Get().GetDeltaTime(), 0.1f);
		Suave = (Suave < 0.f || FMath::Abs(Meta - Suave) > Max) ? Meta : FMath::Lerp(Suave, Meta, 1.f - FMath::Exp(-16.f * Dt));
		const float Ang = Suave;
		const FVector2D Tam = G.GetLocalSize();
		const FVector2f C((float)Tam.X * 0.5f, (float)Tam.Y - 12.f);
		const float R = FMath::Min((float)Tam.X * 0.5f - 8.f, (float)Tam.Y - 22.f);
		const auto En = [&](float Grados, float Radio) { const float A = FMath::DegreesToRadians(Grados); return C + FVector2f(FMath::Cos(A), -FMath::Sin(A)) * Radio; };
		const auto Arco = [&](float A0, float A1, float Radio, const FLinearColor& Col, float Grosor, int32 L)
		{
			TArray<FVector2f> P;
			const int32 N = FMath::Max(2, FMath::CeilToInt(FMath::Abs(A1 - A0) / 3.f) + 1);
			for (int32 k = 0; k < N; ++k) { P.Add(En(FMath::Lerp(A0, A1, (float)k / (N - 1)), Radio)); }
			FSlateDrawElement::MakeLines(Fuera, L, G.ToPaintGeometry(), P, ESlateDrawEffect::None, Col, true, Grosor);
		};
		const auto Linea = [&](const FVector2f& A, const FVector2f& B, const FLinearColor& Col, float Grosor, int32 L)
		{
			FSlateDrawElement::MakeLines(Fuera, L, G.ToPaintGeometry(), TArray<FVector2f>({ A, B }), ESlateDrawEffect::None, Col, true, Grosor);
		};
		const FLinearColor& Gris = C_GONIO_ESCALA;
		const FLinearColor& Naranja = C_AMBAR;
		Arco(0.f, 180.f, R, C_GONIO_FONDO, 2.f, Capa);                                 // transportador entero
		for (int32 g = 0; g <= 180; g += 15) { Linea(En((float)g, R - (g % 45 == 0 ? 10.f : 5.f)), En((float)g, R), Gris, 1.f, Capa); }
		Arco(0.f, Max, R, Gris, 5.f, Capa + 1);                                        // rango de este movimiento
		Arco(0.f, Ang, R, Naranja, 5.f, Capa + 2);                                     // recorrido
		Linea(En(Max, R - 14.f), En(Max, R + 6.f), C_TINTA, 2.f, Capa + 2);             // tope
		Linea(C, En(0.f, R - 4.f), C_GRIS, 3.f, Capa + 2);                              // brazo fijo
		Linea(C, En(Ang, R - 4.f), C_TINTA, 3.5f, Capa + 3);                            // brazo móvil
		FSlateDrawElement::MakeBox(Fuera, Capa + 4, G.ToPaintGeometry(FVector2D(12, 12), FSlateLayoutTransform(FVector2D(C) - FVector2D(6, 6))), Punto(), ESlateDrawEffect::None, Naranja);
		return Capa + 4;
	}
};

SCorpusInterfaz::~SCorpusInterfaz()
{
	if (ACorpusCuerpo* C = Cuerpo()) { C->AlCambiarSeleccion.Remove(HSel); C->AlCambiarCapas.Remove(HCapas); C->AlCambiarPostura.Remove(HPostura); C->AlCambiarHerramientas.Remove(HHerr); }
	if (UCorpusDatos* D = Datos()) { D->AlCambiarIdioma.Remove(HIdioma); }
}

ACorpusCuerpo* SCorpusInterfaz::Cuerpo() const
{
	return Jugador.IsValid() ? Jugador->Cuerpo() : nullptr;
}

UCorpusDatos* SCorpusInterfaz::Datos() const
{
	const UGameInstance* GI = Jugador.IsValid() ? Jugador->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UCorpusDatos>() : nullptr;
}

TSharedRef<SWidget> SCorpusInterfaz::Boton(const FString& Texto, TFunction<void()> Accion, ECorpusBoton Papel) const
{
	return ConFoco(SNew(SButton)
		.ButtonStyle(&EstiloBoton(Papel))
		.ContentPadding(RELLENO_BOTON)
		.VAlign(VAlign_Center)
		.OnClicked_Lambda([Accion]() { Accion(); return FReply::Handled(); })
		[ SNew(STextBlock).Text(FText::FromString(Texto)).Font(Letra(T_CUERPO, Papel == ECorpusBoton::Normal ? EPeso::Regular : EPeso::Media))
			.ColorAndOpacity(FSlateColor(ColorTextoBoton(Papel))) ]);   // una sola línea: «Mostrar todo», «100 %» no se parten
}

void SCorpusInterfaz::PonerTamTexto(int32 Por)
{
	TamTexto = (Por == 90 || Por == 125 || Por == 150) ? Por : 100;
	if (GConfig)
	{
		GConfig->SetInt(INI_SECCION, INI_TAM_TEXTO, TamTexto, GGameUserSettingsIni);
		GConfig->Flush(false, GGameUserSettingsIni);
	}
}

bool SCorpusInterfaz::Escribiendo()
{
	if (!FSlateApplication::IsInitialized()) { return false; }
	const TSharedPtr<SWidget> F = FSlateApplication::Get().GetKeyboardFocusedWidget();
	if (!F.IsValid()) { return false; }
	const FName Tipo = F->GetType();
	return Tipo == FName(TEXT("SEditableText")) || Tipo == FName(TEXT("SMultiLineEditableText")) || Tipo == FName(TEXT("SEditableTextBox"));
}

void SCorpusInterfaz::EnfocarBuscador()
{
	if (Buscador.IsValid() && FSlateApplication::IsInitialized()) { FSlateApplication::Get().SetKeyboardFocus(Buscador, EFocusCause::SetDirectly); }
}

bool SCorpusInterfaz::CerrarConEsc()
{
	// 1) resultados del buscador
	if (Buscador.IsValid() && !Buscador->GetText().IsEmpty())
	{
		Buscador->SetText(FText::GetEmpty());
		RehacerResultados(FText::GetEmpty());
		if (FSlateApplication::IsInitialized()) { FSlateApplication::Get().ClearKeyboardFocus(EFocusCause::Cleared); }
		return true;
	}
	// 2) ficha de la estructura seleccionada
	ACorpusCuerpo* C = Cuerpo();
	if (C && !bVerEst && !C->Seleccionada().IsEmpty()) { C->Seleccionar(FString()); return true; }
	// 3) Estudiar
	if (bVerEst) { AbrirEstudio(false); return true; }
	return false;
}

// ───────── Animación de los paneles ─────────

EVisibility SCorpusInterfaz::VisAnim(int32 i) const
{
	const FPanelAnim& A = Anim[i];
	const bool bVer = A.Ver && A.Ver();
	if (bVer) { return EVisibility::Visible; }
	return A.V > 0.01f ? EVisibility::HitTestInvisible : EVisibility::Collapsed;   // se está yendo: se ve, pero no se pulsa
}

void SCorpusInterfaz::Tick(const FGeometry& G, const double Tiempo, const float Dt)
{
	SCompoundWidget::Tick(G, Tiempo, Dt);
	// escala: la curva del plan por el lado corto de la ventana en píxeles × «Tamaño del texto». El motor ya aplica su propia
	// escala por resolución (curva de DefaultEngine.ini, que no se toca): se descuenta para que mande la nuestra.
	{
		const float EscMotor = FMath::Max((float)G.GetAccumulatedLayoutTransform().GetScale(), 0.01f);
		const FVector2D Local = G.GetLocalSize();
		const FVector2D Px = Local * (double)EscMotor;
		if (Px.X > 1.0 && Px.Y > 1.0)
		{
			float Meta = EscalaPorLado((float)FMath::Min(Px.X, Px.Y)) * TamTexto / 100.f;
			// con letra grande en ventanas estrechas, tope para que capas, buscador y ficha quepan sin pisarse
			Meta = FMath::Min(Meta, (float)Px.X / ANCHO_MIN_PANELES);
			const float Nueva = Meta / EscMotor;
			if (FMath::Abs(Nueva - EscalaUI) > 0.001f) { EscalaUI = Nueva; }
		}
	}
	TamVista = FVector2D(G.GetLocalSize()) / (double)FMath::Max(EscalaUI, 0.01f);   // en las unidades de dentro del SDPIScaler
	// zona libre para los rótulos de los relieves: medida sobre los paneles de verdad (no con cifras fijas)
	if (Marcas.IsValid())
	{
		const bool bIzq = Anim[P_IZQ].W.IsValid() && Anim[P_IZQ].V > 0.5f;
		const TSharedPtr<SWidget>& Izq = bIzq ? Anim[P_IZQ].W : Anim[P_MINI].W;
		Marcas->LimIzq = M_PANTALLA + (Izq.IsValid() ? Izq->GetDesiredSize().X : 0.0) + E_2;
		const bool bFicha = Anim[P_FICHA].W.IsValid() && Anim[P_FICHA].V > 0.01f;
		Marcas->LimDer = M_PANTALLA + (bFicha ? Anim[P_FICHA].W->GetDesiredSize().X : 0.0) + E_2;
		// solo el campo del buscador (más su marco): la lista de resultados se cierra con Esc
		Marcas->LimArriba = M_PANTALLA + 2.0 * E_3 + (Buscador.IsValid() ? Buscador->GetDesiredSize().Y : 40.0) + E_2;
	}
	// acercamiento exponencial: ~200 ms hasta el 95 %; suave al principio y al final por el deslizamiento con curva
	const float K = 1.f - FMath::Exp(-15.f * EscalaAnim * FMath::Min(Dt, 0.1f));
	for (FPanelAnim& A : Anim)
	{
		if (!A.W.IsValid()) { continue; }
		const float Meta = (A.Ver && A.Ver()) ? 1.f : 0.f;
		A.V = FMath::Abs(Meta - A.V) < 0.002f ? Meta : FMath::Lerp(A.V, Meta, K);
		const float E = FMath::InterpEaseOut(0.f, 1.f, A.V, 2.f);
		A.W->SetRenderOpacity(A.V);
		A.W->SetRenderTransform(FSlateRenderTransform(A.Desde * (1.f - E)));
	}
}

void SCorpusInterfaz::Construct(const FArguments& Args)
{
	Jugador = Args._Jugador;
	SetVisibility(EVisibility::SelfHitTestInvisible);

	// «Tamaño del texto» guardado en la configuración del usuario (GameUserSettings.ini)
	{
		int32 Guardado = 100;
		if (GConfig && GConfig->GetInt(INI_SECCION, INI_TAM_TEXTO, Guardado, GGameUserSettingsIni)) { TamTexto = (Guardado == 90 || Guardado == 125 || Guardado == 150) ? Guardado : 100; }
	}

	// paneles animados: condición para estar a la vista y desde dónde entran (desplazamientos ≤ 12 px, PLAN_INTERFAZ.md)
	Anim[P_IZQ].Ver = [this]() { return !bPanelPlegado; };                     Anim[P_IZQ].Desde = FVector2D(-12, 0);
	Anim[P_MINI].Ver = [this]() { return bPanelPlegado; };                     Anim[P_MINI].Desde = FVector2D(-8, 0);
	Anim[P_BUSCA].Ver = []() { return true; };                                 Anim[P_BUSCA].Desde = FVector2D(0, -8);
	Anim[P_MOV].Ver = [this]() { const ACorpusCuerpo* C = Cuerpo(); return !bVerEst && C && C->MovimientoDisponible() && (bVerMov || C->HayPostura()); };
	Anim[P_MOV].Desde = FVector2D(0, 12);
	Anim[P_FICHA].Ver = [this]() { const ACorpusCuerpo* C = Cuerpo(); return !bVerEst && C && !C->Seleccionada().IsEmpty(); };
	Anim[P_FICHA].Desde = FVector2D(12, 0);
	Anim[P_EST].Ver = [this]() { return bVerEst; };                            Anim[P_EST].Desde = FVector2D(12, 0);

	ChildSlot
	[
		// toda la interfaz escala con la ventana y con «Tamaño del texto» (EscalaUI se calcula en Tick)
		SNew(SDPIScaler).DPIScale_Lambda([this]() { return EscalaUI; })
		[
		SNew(SOverlay)
		// ── Debajo de los paneles: marcas de los relieves óseos sobre el modelo ──
		+ SOverlay::Slot().HAlign(HAlign_Fill).VAlign(VAlign_Fill)[ SAssignNew(Marcas, SCorpusMarcas) ]
		// ── Panel izquierdo: cuerpo, idioma y capas ──
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Fill).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_IZQ].W, SBox).WidthOverride(360.f)
			.Visibility_Lambda([this]() { return VisAnim(P_IZQ); })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(RELLENO_PANEL)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(TEXT("CORPUS"), T_MARCA_CORPUS, C_TINTA, EPeso::Negrita) ]
						// plegar el panel: el modelo ocupa toda la pantalla
						+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[ Boton(TEXT("«"), [this]() { bPanelPlegado = true; }) ]
					]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, E_1, 0, E_3)[ SAssignNew(CajaBarra, SVerticalBox) ]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, E_2)[ SAssignNew(CajaHerr, SVerticalBox) ]
					+ SVerticalBox::Slot().FillHeight(1.f)
					[
						SNew(SScrollBox).ScrollBarStyle(&EstiloRollo()).ScrollBarThickness(GROSOR_ROLLO)
						+ SScrollBox::Slot()[ SAssignNew(CajaCapas, SVerticalBox) ]
					]
				]
			]
		]
		// ── Panel izquierdo plegado: solo un botón para volver a abrirlo ──
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_MINI].W, SBox)
			.Visibility_Lambda([this]() { return VisAnim(P_MINI); })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(E_2)[ SAssignNew(CajaMini, SVerticalBox) ]
			]
		]
		// ── Arriba: buscador ──
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Top).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_BUSCA].W, SBox).WidthOverride(460.f)
			[
				SNew(SBorder).BorderImage(Panel()).Padding(E_3)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SAssignNew(Buscador, SEditableTextBox).Style(&EstiloCampo())
						.OnTextChanged(this, &SCorpusInterfaz::RehacerResultados)
						// Esc dentro del buscador: borra la búsqueda y suelta el foco (no llega al modelo)
						.OnKeyDownHandler_Lambda([this](const FGeometry&, const FKeyEvent& K)
						{
							if (K.GetKey() == EKeys::Escape && Buscador.IsValid())
							{
								const bool bHabia = !Buscador->GetText().IsEmpty();
								if (bHabia) { Buscador->SetText(FText::GetEmpty()); RehacerResultados(FText::GetEmpty()); }
								FSlateApplication::Get().ClearKeyboardFocus(EFocusCause::Cleared);
								return bHabia ? FReply::Handled() : FReply::Unhandled();   // vacío: Esc sigue (cierra la ficha o Estudiar)
							}
							return FReply::Unhandled();
						})
					]
					+ SVerticalBox::Slot().AutoHeight().MaxHeight(420.f)
					[
						SNew(SScrollBox).ScrollBarStyle(&EstiloRollo()).ScrollBarThickness(GROSOR_ROLLO)
						+ SScrollBox::Slot()[ SAssignNew(CajaResultados, SVerticalBox) ]
					]
				]
			]
		]
		// ── Abajo: movimiento (rango articular) ──
		// (a la derecha: en el centro tapaba las piernas y los pies, que es lo que hay que ver en la marcha)
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Bottom).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_MOV].W, SBox).WidthOverride(520.f)
			.Visibility_Lambda([this]() { return VisAnim(P_MOV); })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(E_4)[ SAssignNew(CajaMov, SVerticalBox) ]
			]
		]
		// ── Derecha: ficha de la estructura seleccionada ──
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_FICHA].W, SBox).WidthOverride(400.f)
			// la ficha no baja hasta el panel de movimiento (antes se pisaban): se acorta y su contenido se desplaza.
			// TamVista y los tamaños deseados están en las mismas unidades (dentro del SDPIScaler).
			.MaxDesiredHeight_Lambda([this]()
			{
				const float Alto = FMath::Max((float)TamVista.Y, 400.f);
				const float Mov = (Anim[P_MOV].W.IsValid() && Anim[P_MOV].V > 0.01f) ? (float)Anim[P_MOV].W->GetDesiredSize().Y + M_PANTALLA : 0.f;
				return FOptionalSize(FMath::Clamp(Alto - 2.f * M_PANTALLA - Mov - E_3, 120.f, 860.f));
			})
			.Visibility_Lambda([this]()
			{
				// con el texto grande el panel de movimiento puede ocupar casi toda la altura: si la ficha no cabe
				// encima (menos de 120), se oculta en lugar de montarse sobre él
				if (Anim[P_MOV].W.IsValid() && Anim[P_MOV].V > 0.01f)
				{
					const float Libre = FMath::Max((float)TamVista.Y, 400.f) - 2.f * M_PANTALLA - (float)Anim[P_MOV].W->GetDesiredSize().Y - M_PANTALLA - E_3;
					if (Libre < 120.f) { return EVisibility::Collapsed; }
				}
				return VisAnim(P_FICHA);
			})
			[
				SNew(SBorder).BorderImage(Panel()).Padding(RELLENO_PANEL)
				[
					SNew(SScrollBox).ScrollBarStyle(&EstiloRollo()).ScrollBarThickness(GROSOR_ROLLO)
					+ SScrollBox::Slot()[ SAssignNew(CajaFicha, SVerticalBox) ]
				]
			]
		]
		// ── Derecha, a toda la altura: panel de estudio (lecciones, recorridos, kinesiología, casos, patologías, glosario) ──
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Fill).Padding(M_PANTALLA)
		[
			SAssignNew(Anim[P_EST].W, SBox).WidthOverride(500.f)
			.Visibility_Lambda([this]() { return VisAnim(P_EST); })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(RELLENO_PANEL)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[ SAssignNew(CajaEstCab, SVerticalBox) ]
					+ SVerticalBox::Slot().FillHeight(1.f).Padding(0, E_2, 0, 0)
					[
						SAssignNew(RolloEst, SScrollBox).ScrollBarStyle(&EstiloRollo()).ScrollBarThickness(GROSOR_ROLLO)
						+ SScrollBox::Slot()[ SAssignNew(CajaEst, SVerticalBox) ]
					]
				]
			]
		]
		]
	];

	if (ACorpusCuerpo* C = Cuerpo())
	{
		HSel = C->AlCambiarSeleccion.AddSP(this, &SCorpusInterfaz::RehacerFicha);
		HCapas = C->AlCambiarCapas.AddSP(this, &SCorpusInterfaz::RehacerCapas);
		HPostura = C->AlCambiarPostura.AddSP(this, &SCorpusInterfaz::AlCambiarPostura);
		HHerr = C->AlCambiarHerramientas.AddSP(this, &SCorpusInterfaz::RehacerHerramientas);
	}
	if (UCorpusDatos* D = Datos()) { HIdioma = D->AlCambiarIdioma.AddSP(this, &SCorpusInterfaz::Reconstruir); }
	if (Marcas.IsValid()) { Marcas->Jugador = Jugador; }
	Reconstruir();
}

void SCorpusInterfaz::Reconstruir()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaBarra.IsValid()) { return; }
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	TWeakObjectPtr<UCorpusDatos> WD(D);
	TWeakObjectPtr<ACorpusJugador> WJ(Jugador);

	if (Buscador.IsValid()) { Buscador->SetHintText(FText::FromString(D->T(TEXT("Buscar estructura…")))); }

	if (CajaMini.IsValid())
	{
		CajaMini->ClearChildren();
		CajaMini->AddSlot().AutoHeight()[ Boton(TEXT("»  ") + D->T(TEXT("Capas")), [this]() { bPanelPlegado = false; }) ];
	}

	CuerpoPintado = (uint8)C->Cuerpo();
	CajaBarra->ClearChildren();
	CajaBarra->AddSlot().AutoHeight()[ Txt(D->T(TEXT("Atlas anatómico 3D libre")), T_SECUNDARIO, C_GRIS) ];

	// Cuerpo: hombre, mujer o Visible Human
	TSharedRef<SWrapBox> FilaCuerpo = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	const TPair<const TCHAR*, ECorpusCuerpo> Cuerpos[] = { {TEXT("Hombre"), ECorpusCuerpo::Hombre}, {TEXT("Mujer"), ECorpusCuerpo::Mujer}, {TEXT("Visible Human"), ECorpusCuerpo::VisibleHuman} };
	for (const auto& Par : Cuerpos)
	{
		const ECorpusCuerpo Cual = Par.Value;
		FilaCuerpo->AddSlot()[ BotonSel(D->T(Par.Key), [WC, Cual]() { if (WC.IsValid()) { WC->PonerCuerpo(Cual); } }, C->Cuerpo() == Cual) ];
	}
	CajaBarra->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ FilaCuerpo ];

	// Idioma
	TSharedRef<SWrapBox> FilaIdioma = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	for (const TCHAR* L : { TEXT("es"), TEXT("en"), TEXT("pt"), TEXT("fr"), TEXT("de") })
	{
		const FString Cod(L);
		FilaIdioma->AddSlot()[ BotonSel(Cod.ToUpper(), [WD, Cod]() { if (WD.IsValid()) { WD->PonerIdioma(Cod); } }, D->Idioma() == Cod) ];
	}
	CajaBarra->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ FilaIdioma ];

	// Tamaño del texto (90 · 100 · 125 · 150 %): multiplica la escala por resolución; se guarda para la próxima vez
	CajaBarra->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(D->T(TEXT("Tamaño del texto"))) ];
	TSharedRef<SWrapBox> FilaTam = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	for (const int32 Por : { 90, 100, 125, 150 })
	{
		FilaTam->AddSlot()[ BotonSel(FString::Printf(TEXT("%d %%"), Por), [this, Por]() { PonerTamTexto(Por); Reconstruir(); }, TamTexto == Por) ];
	}
	CajaBarra->AddSlot().AutoHeight()[ FilaTam ];

	// Vistas fijas y mostrar todo
	TSharedRef<SWrapBox> FilaVistas = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	const TCHAR* Vistas[] = { TEXT("Anterior"), TEXT("Posterior"), TEXT("Derecha"), TEXT("Izquierda"), TEXT("Superior"), TEXT("Inferior") };
	for (int32 i = 0; i < 6; ++i)
	{
		FilaVistas->AddSlot()[ Boton(D->T(Vistas[i]), [WJ, i]() { if (WJ.IsValid() && WJ->CamaraOrbital()) { WJ->CamaraOrbital()->Vista(i); } }) ];
	}
	FilaVistas->AddSlot()[ Boton(D->T(TEXT("Mostrar todo")), [WC]() { if (WC.IsValid()) { WC->MostrarTodo(); } }) ];
	if (C->MovimientoDisponible())
	{
		FilaVistas->AddSlot()[ Boton(D->T(TEXT("Movimiento")), [this, WC]()
		{
			bVerMov = !bVerMov;
			if (WC.IsValid() && !bVerMov) { WC->PonerMarcha(-1, 0.f); WC->PonerEjercicio(-1, 0, 0.f); WC->QuitarPostura(); }
			MovPintado = FIntVector(-2, -2, -2); RehacerMovimiento();
		}, bVerMov ? ECorpusBoton::Seleccionado : ECorpusBoton::Normal) ];
	}
	FilaVistas->AddSlot()[ BotonSel(D->TE(TEXT("Estudiar")), [this]() { AbrirEstudio(!bVerEst); }, bVerEst) ];
	CajaBarra->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ FilaVistas ];

	RehacerEstudio();
	RehacerHerramientas();
	RehacerCapas();
	RehacerFicha();
	MovPintado = FIntVector(-2, -2, -2);
	RehacerMovimiento();
}

void SCorpusInterfaz::RehacerHerramientas()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaHerr.IsValid()) { return; }
	CajaHerr->ClearChildren();
	TWeakObjectPtr<ACorpusCuerpo> WC(C);

	// ── Fantasma: todo translúcido menos la capa de la pieza seleccionada (sin selección, menos los huesos) ──
	CajaHerr->AddSlot().AutoHeight().Padding(0, E_1, 0, E_1)[ Etiqueta(D->T(TEXT("Disección"))) ];
	CajaHerr->AddSlot().AutoHeight()
	[
		SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO))
		+ SWrapBox::Slot()[ BotonSel(D->T(TEXT("Fantasma")), [WC]() { if (WC.IsValid()) { WC->Fantasma(!WC->EnFantasma()); } }, C->EnFantasma()) ]
	];

	// ── Plano de corte: sagital, coronal o axial (otra vez sobre el activo lo apaga), posición e invertir ──
	CajaHerr->AddSlot().AutoHeight().Padding(0, E_2, 0, E_1)[ Etiqueta(D->T(TEXT("Plano de corte"))) ];
	TSharedRef<SWrapBox> FilaCorte = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	const TCHAR* Ejes[] = { TEXT("Sagital"), TEXT("Coronal"), TEXT("Axial") };
	const int32 Eje = C->EjeCorte();
	for (int32 i = 0; i < 3; ++i)
	{
		FilaCorte->AddSlot()[ BotonSel(D->T(Ejes[i]), [WC, i]() { if (WC.IsValid()) { if (WC->EjeCorte() == i) { WC->QuitarCorte(); } else { WC->PonerCorte(i, 0.5f); } } }, Eje == i) ];
	}
	if (Eje >= 0)
	{
		FilaCorte->AddSlot()[ BotonSel(D->T(TEXT("Invertir")), [WC]() { if (WC.IsValid()) { WC->InvertirCorte(); } }, C->CorteInvertido()) ];
		FilaCorte->AddSlot()[ Boton(D->T(TEXT("Quitar corte")), [WC]() { if (WC.IsValid()) { WC->QuitarCorte(); } }) ];
	}
	CajaHerr->AddSlot().AutoHeight()[ FilaCorte ];
	if (Eje >= 0)
	{
		CajaHerr->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)
		[
			SNew(SSlider).Style(&EstiloDeslizador()).MinValue(0.f).MaxValue(1.f)
			.ToolTipText_Lambda([WC]() { return FText::FromString(FString::Printf(TEXT("%d %%"), WC.IsValid() ? FMath::RoundToInt(100.f * WC->PosCorte()) : 50)); })
			.Value_Lambda([WC]() { return WC.IsValid() ? WC->PosCorte() : 0.5f; })
			.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid() && WC->EjeCorte() >= 0) { WC->PonerCorte(WC->EjeCorte(), V); } })
		];
	}
	RehacerFicha();   // la ficha pinta el estado del mapa de origen e inserción
}

void SCorpusInterfaz::AlCambiarPostura()
{
	// en reproducción la postura cambia en cada fotograma: el panel solo se rehace si cambian rango, movimiento o lado
	const ACorpusCuerpo* C = Cuerpo();
	if (!C) { return; }
	if (ClaveMov() != MovPintado) { RehacerMovimiento(); }
}

// Con qué se pintó el panel de movimiento: modo (rango, marcha 1000+, ejercicio 2000+), movimiento o variante, y botones encendidos
FIntVector SCorpusInterfaz::ClaveMov() const
{
	const ACorpusCuerpo* C = Cuerpo();
	if (!C) { return FIntVector(-2, -2, -2); }
	if (C->Ejercicio() >= 0) { return FIntVector(2000 + C->Ejercicio(), C->VarianteDeEjercicio(), (C->EjercicioEnCurso() ? 16 : 0) + (C->EsEjercicioLento() ? 32 : 0) + (bEjTecnica ? 64 : 0)); }
	return FIntVector(C->PatronMarcha() >= 0 ? 1000 + C->PatronMarcha() : C->Rango(), C->Movimiento(), (C->LadoIzquierdo() ? 1 : 0) + (C->Reproduciendo() ? 2 : 0) + (C->MarchaEnCurso() ? 4 : 0) + (C->EsMarchaLenta() ? 8 : 0));
}

void SCorpusInterfaz::RehacerMovimiento()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaMov.IsValid()) { return; }
	MovPintado = ClaveMov();
	CajaMov->ClearChildren();
	if (!C->MovimientoDisponible()) { return; }
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	const TArray<FCorpusRango>& Rs = D->Rangos();
	const int32 Ri = C->Rango(), Mi = C->Movimiento();
	const bool bIzq = C->LadoIzquierdo();

	// modo: rango articular o marcha
	const bool bMarcha = C->PatronMarcha() >= 0;
	const int32 Ei = C->Ejercicio();
	const bool bEj = D->Ejercicios().IsValidIndex(Ei);
	TWeakObjectPtr<ACorpusJugador> WJ(Jugador);
	{
		TSharedRef<SHorizontalBox> Modos = SNew(SHorizontalBox);
		Modos->AddSlot().AutoWidth().Padding(0, 0, HUECO, 0)[ BotonSel(D->T(TEXT("Rango articular")), [WC]() { if (WC.IsValid()) { WC->PonerMarcha(-1, 0.f); WC->PonerEjercicio(-1, 0, 0.f); } }, !bMarcha && !bEj) ];
		if (D->PatronesMarcha().Num() > 0)
		{
			Modos->AddSlot().AutoWidth().Padding(0, 0, HUECO, 0)[ BotonSel(D->T(TEXT("Marcha")), [WC]() { if (WC.IsValid()) { WC->QuitarPostura(); WC->PonerMarcha(0, 0.f); WC->ReproducirMarcha(true); } }, bMarcha) ];
		}
		if (D->Ejercicios().Num() > 0)
		{
			// ejercicios horneados (movimiento.json → ejercicios): al entrar, la vista que pide el ejercicio
			Modos->AddSlot().AutoWidth()[ BotonSel(D->TEj(TEXT("modo")), [WC, WJ, D]()
			{
				if (!WC.IsValid()) { return; }
				WC->QuitarPostura(); WC->PonerEjercicio(0, -1, 0.f); WC->ReproducirEjercicio(true);
				if (WJ.IsValid() && WJ->CamaraOrbital() && D->Ejercicios().Num() > 0) { WJ->CamaraOrbital()->Vista(D->Ejercicios()[0].Vista); }
			}, bEj) ];
		}
		CajaMov->AddSlot().AutoHeight().Padding(0, 0, 0, E_2)[ Modos ];
	}
	if (bEj)
	{
		const FCorpusEjercicio& E = D->Ejercicios()[Ei];
		const int32 Vi = C->VarianteDeEjercicio();
		TWeakObjectPtr<UCorpusDatos> WD(D);
		// ejercicio y variante (profundidad…)
		TSharedRef<SWrapBox> FilaE = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
		for (int32 i = 0; i < D->Ejercicios().Num(); ++i)
		{
			FilaE->AddSlot()[ BotonSel(D->Tx(D->Ejercicios()[i].Nombre), [WC, i]() { if (WC.IsValid()) { WC->PonerEjercicio(i, -1, 0.f); WC->ReproducirEjercicio(true); } }, i == Ei) ];
		}
		if (E.Variantes.Num() > 1)
		{
			FilaE->AddSlot()[ SNew(SSpacer).Size(FVector2D(E_2, 1)) ];
			for (int32 v = 0; v < E.Variantes.Num(); ++v)
			{
				FilaE->AddSlot()[ BotonSel(D->Tx(E.Variantes[v].Nombre), [WC, Ei, v]() { if (WC.IsValid()) { WC->PonerEjercicio(Ei, v, WC->CicloDeEjercicio()); } }, v == Vi) ];
			}
		}
		CajaMov->AddSlot().AutoHeight()[ FilaE ];
		// fase del ciclo (excéntrica al bajar, isométrica abajo, concéntrica al subir) y qué ocurre en ella
		CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)
		[
			SNew(STextBlock).Font(Letra(T_SECCION, EPeso::Media)).ColorAndOpacity(FSlateColor(C_TINTA))
			.Text_Lambda([WC, WD, Ei]()
			{
				if (!WC.IsValid() || !WD.IsValid() || !WD->Ejercicios().IsValidIndex(Ei)) { return FText(); }
				const TArray<FCorpusFaseEj>& Fs = WD->Ejercicios()[Ei].Fases; const int32 F = WC->FaseDeEjercicio();
				if (!Fs.IsValidIndex(F)) { return FText(); }
				FString S = WD->Tx(Fs[F].Nombre);
				// el tipo de contracción, si el nombre de la fase no lo dice ya
				if (!Fs[F].Tipo.IsEmpty()) { const FString Tp = WD->TEj(Fs[F].Tipo); if (!S.Contains(Tp.ToLower())) { S += TEXT(" · ") + Tp; } }
				return FText::FromString(FString::Printf(TEXT("%s · %d %%"), *S, FMath::RoundToInt(WC->CicloDeEjercicio())));
			})
		];
		CajaMov->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)
		[
			SNew(STextBlock).Font(Letra(T_CUERPO)).ColorAndOpacity(FSlateColor(C_TINTA)).AutoWrapText(true)
			.Text_Lambda([WC, WD, Ei]()
			{
				if (!WC.IsValid() || !WD.IsValid() || !WD->Ejercicios().IsValidIndex(Ei)) { return FText(); }
				const TArray<FCorpusFaseEj>& Fs = WD->Ejercicios()[Ei].Fases; const int32 F = WC->FaseDeEjercicio();
				return Fs.IsValidIndex(F) ? FText::FromString(WD->Tx(Fs[F].Texto)) : FText();
			})
		];
		// ángulos de este instante (cadera, rodilla, tobillo, tronco…)
		if (E.Medidas.Num() > 0)
		{
			CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)
			[
				SNew(STextBlock).Font(Letra(T_NOTA, EPeso::Media)).ColorAndOpacity(FSlateColor(C_AMBAR))
				.Text_Lambda([WC, WD, Ei]()
				{
					if (!WC.IsValid() || !WD.IsValid() || !WD->Ejercicios().IsValidIndex(Ei)) { return FText(); }
					const TArray<FCorpusTexto>& Ms = WD->Ejercicios()[Ei].Medidas; const TArray<float> V = WC->MedidasDeEjercicio();
					FString S;
					for (int32 i = 0; i < FMath::Min(Ms.Num(), V.Num()); ++i) { S += FString::Printf(TEXT("%s%s %d°"), i ? TEXT("  ·  ") : TEXT(""), *WD->Tx(Ms[i]), FMath::RoundToInt(V[i])); }
					return FText::FromString(S);
				})
			];
		}
		TSharedRef<SHorizontalBox> FilaC = SNew(SHorizontalBox);
		FilaC->AddSlot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider).Style(&EstiloDeslizador()).MinValue(0.f).MaxValue(99.9f)
			.ToolTipText_Lambda([WC]() { return FText::FromString(FString::Printf(TEXT("%d %%"), WC.IsValid() ? FMath::RoundToInt(WC->CicloDeEjercicio()) : 0)); })
			.Value_Lambda([WC]() { return WC.IsValid() ? WC->CicloDeEjercicio() : 0.f; })
			.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid()) { WC->ReproducirEjercicio(false); WC->PonerEjercicio(WC->Ejercicio(), WC->VarianteDeEjercicio(), V); } })
		];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(E_3, 0, 0, 0)[ Boton(D->T(C->EjercicioEnCurso() ? TEXT("Pausa") : TEXT("Reproducir")), [WC]() { if (WC.IsValid()) { WC->ReproducirEjercicio(!WC->EjercicioEnCurso()); } }, ECorpusBoton::Principal) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(HUECO, 0, 0, 0)[ BotonSel(D->T(TEXT("Cámara lenta")), [WC]() { if (WC.IsValid()) { WC->EjercicioLento(!WC->EsEjercicioLento()); } }, C->EsEjercicioLento()) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(HUECO, 0, 0, 0)[ Boton(D->T(TEXT("Reposo")), [WC]() { if (WC.IsValid()) { WC->PonerEjercicio(-1, 0, 0.f); } }) ];
		CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ FilaC ];
		CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, HUECO, 0)[ BotonSel(D->TEj(TEXT("musculos")), [this]() { bEjTecnica = false; RehacerMovimiento(); }, !bEjTecnica) ]
			+ SHorizontalBox::Slot().AutoWidth()[ BotonSel(D->TEj(TEXT("tecnica")), [this]() { bEjTecnica = true; RehacerMovimiento(); }, bEjTecnica) ]
		];
		if (bEjTecnica)
		{
			// técnica: qué trabaja, cómo se hace, qué observar, errores, progresiones y precauciones (textos de la web)
			TSharedRef<SVerticalBox> Tec = SNew(SVerticalBox);
			for (const auto& Par : E.Textos)
			{
				Tec->AddSlot().AutoHeight().Padding(0, E_2, 0, E_1)[ Etiqueta(D->Tx(Par.Key)) ];
				Tec->AddSlot().AutoHeight()[ Txt(D->Tx(Par.Value), T_NOTA, C_TINTA) ];
			}
			CajaMov->AddSlot().AutoHeight().MaxHeight(330.f).Padding(0, E_1, 0, 0)
			[
				SNew(SScrollBox).ScrollBarStyle(&EstiloRollo()).ScrollBarThickness(GROSOR_ROLLO) + SScrollBox::Slot()[ Tec ]
			];
		}
		else
		{
			// músculos: cada grupo con su intensidad en este instante (barra) y el tipo de contracción en esta fase
			TSharedRef<SVerticalBox> Ley = SNew(SVerticalBox);
			for (int32 g = 0; g < E.Grupos.Num(); ++g)
			{
				const FCorpusGrupoEj& G = E.Grupos[g];
				Ley->AddSlot().AutoHeight().Padding(0, 2)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
					[
						SNew(STextBlock).Font(Letra(T_SECUNDARIO)).Text(FText::FromString(D->Tx(G.Nombre))).ToolTipText(FText::FromString(D->Tx(G.Texto)))
						.ColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() && WC->NivelDeGrupoEj(g) > 0.05f ? C_TINTA : C_GRIS); })
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(E_2, 0)
					[
						SNew(SBox).WidthOverride(88.f).HeightOverride(8.f)
						[
							SNew(SProgressBar).FillImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderPadding(FVector2D::ZeroVector)
							.Percent_Lambda([WC, g]() { return TOptional<float>(WC.IsValid() ? FMath::Clamp(WC->NivelDeGrupoEj(g), 0.f, 1.f) : 0.f); })
							.FillColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() ? ACorpusCuerpo::ColorDeIntensidad(WC->NivelDeGrupoEj(g)) : C_GRIS); })
						]
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
					[
						SNew(SBox).WidthOverride(96.f)
						[
							SNew(STextBlock).Font(Letra(T_SECUNDARIO)).ColorAndOpacity(FSlateColor(C_GRIS))
							.Text_Lambda([WC, WD, Ei, g]()
							{
								if (!WC.IsValid() || !WD.IsValid() || !WD->Ejercicios().IsValidIndex(Ei) || !WD->Ejercicios()[Ei].Grupos.IsValidIndex(g)) { return FText(); }
								const TArray<FString>& Tp = WD->Ejercicios()[Ei].Grupos[g].Tipo; const int32 F = WC->FaseDeEjercicio();
								return (Tp.IsValidIndex(F) && !Tp[F].IsEmpty()) ? FText::FromString(WD->TEj(Tp[F])) : FText();
							})
						]
					]
				];
			}
			CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Ley ];
		}
		CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(D->TEj(TEXT("leyenda")), T_SECUNDARIO, C_GRIS) ];
		return;
	}
	if (bMarcha)
	{
		const TArray<FCorpusPatronMarcha>& Ps = D->PatronesMarcha();
		const int32 Pi = C->PatronMarcha();
		TSharedRef<SWrapBox> FilaP = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
		for (int32 i = 0; i < Ps.Num(); ++i)
		{
			FilaP->AddSlot()[ BotonSel(D->T(Ps[i].Nombre), [WC, i]() { if (WC.IsValid()) { WC->PonerMarcha(i, WC->CicloDeMarcha()); } }, i == Pi) ];
		}
		CajaMov->AddSlot().AutoHeight()[ FilaP ];
		TWeakObjectPtr<UCorpusDatos> WD(D);
		// fase del ciclo (del miembro derecho) y qué ocurre en ella
		CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)
		[
			SNew(STextBlock).Font(Letra(T_SECCION, EPeso::Media)).ColorAndOpacity(FSlateColor(C_TINTA))
			.Text_Lambda([WC, WD]() { if (!WC.IsValid() || !WD.IsValid()) { return FText(); } const int32 F = WC->FaseDeMarcha(); if (!WD->FasesMarcha().IsValidIndex(F)) { return FText(); }
				return FText::FromString(FString::Printf(TEXT("%s · %d %%"), *WD->T(WD->FasesMarcha()[F].Nombre), FMath::RoundToInt(WC->CicloDeMarcha()))); })
		];
		CajaMov->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)
		[
			SNew(STextBlock).Font(Letra(T_CUERPO)).ColorAndOpacity(FSlateColor(C_TINTA)).AutoWrapText(true)
			.Text_Lambda([WC, WD]() { if (!WC.IsValid() || !WD.IsValid()) { return FText(); } const int32 F = WC->FaseDeMarcha(); return WD->FasesMarcha().IsValidIndex(F) ? FText::FromString(WD->T(WD->FasesMarcha()[F].Texto)) : FText(); })
		];
		if (Ps.IsValidIndex(Pi) && !Ps[Pi].Texto.IsEmpty()) { CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(D->T(Ps[Pi].Texto), T_NOTA, C_GRIS) ]; }
		TSharedRef<SHorizontalBox> FilaC = SNew(SHorizontalBox);
		FilaC->AddSlot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider).Style(&EstiloDeslizador()).MinValue(0.f).MaxValue(99.9f)
			.ToolTipText_Lambda([WC]() { return FText::FromString(FString::Printf(TEXT("%d %%"), WC.IsValid() ? FMath::RoundToInt(WC->CicloDeMarcha()) : 0)); })
			.Value_Lambda([WC]() { return WC.IsValid() ? WC->CicloDeMarcha() : 0.f; })
			.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid()) { WC->ReproducirMarcha(false); WC->PonerMarcha(WC->PatronMarcha(), V); } })
		];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(E_3, 0, 0, 0)[ Boton(D->T(C->MarchaEnCurso() ? TEXT("Pausa") : TEXT("Reproducir")), [WC]() { if (WC.IsValid()) { WC->ReproducirMarcha(!WC->MarchaEnCurso()); } }, ECorpusBoton::Principal) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(HUECO, 0, 0, 0)[ BotonSel(D->T(TEXT("Cámara lenta")), [WC]() { if (WC.IsValid()) { WC->MarchaLenta(!WC->EsMarchaLenta()); } }, C->EsMarchaLenta()) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(HUECO, 0, 0, 0)[ Boton(D->T(TEXT("Reposo")), [WC]() { if (WC.IsValid()) { WC->PonerMarcha(-1, 0.f); } }) ];
		CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ FilaC ];
		// leyenda: cada grupo muscular con su intensidad en este instante (barra) y el tipo de contracción (miembro derecho)
		{
			TSharedRef<SVerticalBox> Ley = SNew(SVerticalBox);
			for (int32 g = 0; g < D->GruposMarcha().Num(); ++g)
			{
				const FCorpusGrupoMarcha& G = D->GruposMarcha()[g];
				Ley->AddSlot().AutoHeight().Padding(0, 2)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
					[
						SNew(STextBlock).Font(Letra(T_SECUNDARIO)).Text(FText::FromString(D->T(G.Nombre))).ToolTipText(FText::FromString(D->T(G.Texto)))
						.ColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() && WC->NivelDeGrupo(g) > 0.05f ? C_TINTA : C_GRIS); })
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(E_2, 0)
					[
						SNew(SBox).WidthOverride(72.f).HeightOverride(8.f)
						[
							SNew(SProgressBar).FillImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderPadding(FVector2D::ZeroVector)   // relleno blanco: el color es el de la actividad
							.Percent_Lambda([WC, g]() { return TOptional<float>(WC.IsValid() ? FMath::Clamp(WC->NivelDeGrupo(g) / 0.6f, 0.f, 1.f) : 0.f); })
							.FillColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() ? ACorpusCuerpo::ColorDeNivel(WC->NivelDeGrupo(g)) : C_GRIS); })
						]
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
					[
						SNew(SBox).WidthOverride(96.f)
						[
							SNew(STextBlock).Font(Letra(T_SECUNDARIO)).ColorAndOpacity(FSlateColor(C_GRIS))
							.Text_Lambda([WC, WD, g]()
							{
								if (!WC.IsValid() || !WD.IsValid()) { return FText(); }
								const FString T = WC->TipoDeGrupo(g);
								return FText::FromString(T == TEXT("exc") ? WD->T(TEXT("Excéntrica")) : T == TEXT("con") ? WD->T(TEXT("Concéntrica")) : T == TEXT("iso") ? WD->T(TEXT("Isométrica")) : FString());
							})
						]
					]
				];
			}
			CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Ley ];
		}
		CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(D->T(TEXT("Actividad muscular: amarillo (poca) → magenta (mucha). Datos de laboratorio: Fukuchi 2018, Schreiber 2019, Lencioni 2019.")), T_SECUNDARIO, C_GRIS) ];
		return;
	}
	// goniómetro: el ángulo actual en grande, el máximo del movimiento y el transportador
	if (Rs.IsValidIndex(Ri) && Rs[Ri].Movs.IsValidIndex(Mi))
	{
		TSharedRef<SCorpusGonio> Gonio = SNew(SCorpusGonio);
		Gonio->Cuerpo = WC;
		FString Titulo = D->T(Rs[Ri].Nombre) + TEXT(" · ") + D->NombreMov(Rs[Ri].Movs[Mi]);
		if (Rs[Ri].bLados) { Titulo += TEXT(" · ") + D->T(bIzq ? TEXT("Izquierdo") : TEXT("Derecho")); }
		CajaMov->AddSlot().AutoHeight().Padding(0, 0, 0, E_3)
		[
			SNew(SBorder).BorderImage(Tarjeta()).Padding(FMargin(E_3, E_2))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[ Gonio ]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center).Padding(E_4, 0, 0, 0)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[ Etiqueta(Titulo) ]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, E_1, 0, 0)
					[
						SNew(STextBlock).Font(Letra(T_GONIO, EPeso::Negrita)).ColorAndOpacity(FSlateColor(C_TINTA))
						.Text_Lambda([WC]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("%d°"), FMath::RoundToInt(WC->Grados()))) : FText(); })
					]
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(STextBlock).Font(Letra(T_SECCION, EPeso::Media)).ColorAndOpacity(FSlateColor(C_AMBAR))
						.Text_Lambda([WC, WDm = TWeakObjectPtr<UCorpusDatos>(D)]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("%s %d°  ·  %d %%"), WDm.IsValid() ? *WDm->T(TEXT("máx.")) : TEXT("máx."), FMath::RoundToInt(WC->GradosMax()), WC->GradosMax() > 0.f ? FMath::RoundToInt(100.f * WC->Grados() / WC->GradosMax()) : 0)) : FText(); })
					]
				]
			]
		];
	}
	TSharedRef<SWrapBox> FilaR = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	for (int32 i = 0; i < Rs.Num(); ++i)
	{
		FilaR->AddSlot()[ BotonSel(D->T(Rs[i].Nombre), [WC, i, bIzq]() { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(i, 0, bIzq, 0.f); } }, i == Ri) ];
	}
	CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ FilaR ];
	if (!Rs.IsValidIndex(Ri)) { return; }

	const FCorpusRango& R = Rs[Ri];
	TSharedRef<SWrapBox> FilaM = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	for (int32 m = 0; m < R.Movs.Num(); ++m)
	{
		FilaM->AddSlot()[ BotonSel(D->NombreMov(R.Movs[m]), [WC, Ri, m, bIzq]() { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(Ri, m, bIzq, 0.f); } }, m == Mi) ];
	}
	CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ FilaM ];
	// nota del movimiento (rangos_extra.json): rotación automática de la rodilla, posición de medida… (nota clínica: 11 pt)
	if (R.Movs.IsValidIndex(Mi)) { const FString Nota = D->NotaMov(R.Movs[Mi]); if (!Nota.IsEmpty()) { CajaMov->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(Nota, T_NOTA, C_GRIS) ]; } }

	// lado: en las articulaciones pares, derecho o izquierdo; en el tronco y el cuello, el sentido de la inclinación o el giro.
	// Va en su propia fila: junto al deslizador y los botones se salía del panel con «Hacia la izquierda».
	if (R.Movs.IsValidIndex(Mi) && R.Movs[Mi].Izquierdo.Num() > 0)
	{
		const TCHAR* LD = R.bLados ? TEXT("Derecho") : TEXT("Hacia la derecha");
		const TCHAR* LI = R.bLados ? TEXT("Izquierdo") : TEXT("Hacia la izquierda");
		CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)
		[
			SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO))
			+ SWrapBox::Slot()[ BotonSel(D->T(LD), [WC, Ri, Mi]() { if (WC.IsValid()) { WC->PonerRango(Ri, Mi, false, WC->Grados()); } }, !bIzq) ]
			+ SWrapBox::Slot()[ BotonSel(D->T(LI), [WC, Ri, Mi]() { if (WC.IsValid()) { WC->PonerRango(Ri, Mi, true, WC->Grados()); } }, bIzq) ]
		];
	}
	TSharedRef<SHorizontalBox> Fila = SNew(SHorizontalBox);
	Fila->AddSlot().FillWidth(1.f).VAlign(VAlign_Center)
	[
		SNew(SSlider).Style(&EstiloDeslizador()).MinValue(0.f).MaxValue(1.f)
		.ToolTipText_Lambda([WC]() { return FText::FromString(FString::Printf(TEXT("%d %%"), WC.IsValid() && WC->GradosMax() > 0.f ? FMath::RoundToInt(100.f * WC->Grados() / WC->GradosMax()) : 0)); })
		.Value_Lambda([WC]() { return WC.IsValid() && WC->GradosMax() > 0.f ? WC->Grados() / WC->GradosMax() : 0.f; })
		.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(WC->Rango(), WC->Movimiento(), WC->LadoIzquierdo(), V * WC->GradosMax()); } })
	];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(E_3, 0)
	[
		SNew(SBox).WidthOverride(96.f)
		[
			SNew(STextBlock).Font(Letra(T_BUSCADOR, EPeso::Media)).ColorAndOpacity(FSlateColor(C_TINTA))
			.Text_Lambda([WC]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("%d° / %d°"), FMath::RoundToInt(WC->Grados()), FMath::RoundToInt(WC->GradosMax()))) : FText(); })
		]
	];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center)[ Boton(D->T(C->Reproduciendo() ? TEXT("Pausa") : TEXT("Reproducir")), [WC]() { if (WC.IsValid()) { WC->Reproducir(!WC->Reproduciendo()); } }, ECorpusBoton::Principal) ];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(HUECO, 0, 0, 0)[ Boton(D->T(TEXT("Reposo")), [WC]() { if (WC.IsValid()) { WC->QuitarPostura(); } }) ];
	CajaMov->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ Fila ];
}

void SCorpusInterfaz::RehacerCapas()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaCapas.IsValid()) { return; }
	if ((uint8)C->Cuerpo() != CuerpoPintado) { Reconstruir(); return; }   // cambió el cuerpo: también la barra
	CajaCapas->ClearChildren();
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	FString Grupo;
	for (const FCorpusCapa& Capa : D->Capas())
	{
		if (!C->CapaDisponible(Capa.Clave)) { continue; }
		if (Capa.Grupo != Grupo)
		{
			Grupo = Capa.Grupo;
			CajaCapas->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(D->T(Grupo)) ];
		}
		const FString Clave = Capa.Clave;
		CajaCapas->AddSlot().AutoHeight().Padding(0, 2)
		[
			SNew(SBorder).BorderImage(Panel2()).Padding(FMargin(E_2, HUECO))
			[
				SNew(SHorizontalBox)
				// la fila entera (casilla, color y nombre) enciende o apaga la capa
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
				[
					SNew(SCheckBox).Style(&EstiloCasilla())
					.IsChecked_Lambda([WC, Clave]() { return WC.IsValid() && WC->CapaVisible(Clave) ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
					.OnCheckStateChanged_Lambda([WC, Clave](ECheckBoxState E) { if (WC.IsValid()) { WC->MostrarCapa(Clave, E == ECheckBoxState::Checked); } })
				]
				// color y nombre en su propia columna (con ancho limitado: el nombre termina en «…» antes del deslizador);
				// pulsarlos también enciende o apaga la capa
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center).Padding(E_2, 0, 0, 0)
				[
					SNew(SButton).ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder")).ContentPadding(0)
					.Clipping(EWidgetClipping::ClipToBounds)
					.OnClicked_Lambda([WC, Clave]() { if (WC.IsValid()) { WC->MostrarCapa(Clave, !WC->CapaVisible(Clave)); } return FReply::Handled(); })
					[
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, E_2, 0)
						[
							SNew(SBox).WidthOverride(12.f).HeightOverride(12.f)[ SNew(SImage).Image(Punto()).ColorAndOpacity(Capa.Color) ]
						]
						+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ TxtLinea(D->T(Capa.Nombre), T_CUERPO, C_TINTA) ]
					]
				]
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(E_2, 0, 0, 0)
				[
					SNew(SBox).WidthOverride(72.f)   // fase 2: la opacidad solo aparecerá al pasar el ratón
					[
						SNew(SSlider).Style(&EstiloDeslizador()).MinValue(0.05f).MaxValue(1.f).StepSize(0.05f).MouseUsesStep(true)
						.ToolTipText_Lambda([WC, Clave]() { return FText::FromString(FString::Printf(TEXT("%d %%"), FMath::RoundToInt(100.f * (WC.IsValid() ? WC->OpacidadDeCapa(Clave) : 1.f)))); })
						.Value_Lambda([WC, Clave]() { return WC.IsValid() ? WC->OpacidadDeCapa(Clave) : 1.f; })
						.OnValueChanged_Lambda([WC, Clave](float V) { if (WC.IsValid()) { WC->OpacidadCapa(Clave, V); } })
					]
				]
			]
		];
		// pelar capas: los músculos por profundidad (extras.json → dep), como en la web; encendido = se ve
		if (Clave == TEXT("muscular"))
		{
			TSharedRef<SWrapBox> Pelar = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
			const TPair<const TCHAR*, const TCHAR*> Profs[] = { {TEXT("s"), TEXT("Superficiales")}, {TEXT("i"), TEXT("Intermedios")}, {TEXT("p"), TEXT("Profundos")} };
			for (const auto& Par : Profs)
			{
				const FString Pf(Par.Key);
				Pelar->AddSlot()
				[ BotonSel(D->T(Par.Value), [WC, Pf]() { if (WC.IsValid()) { WC->PelarProfundidad(Pf, !WC->ProfundidadOculta(Pf)); } }, !C->ProfundidadOculta(Pf)) ];
			}
			CajaCapas->AddSlot().AutoHeight().Padding(E_2, E_1, 0, E_2)[ Pelar ];
		}
	}
}

bool SCorpusInterfaz::Qa(const FString& Verbo, const FString& Resto)
{
	// panel <0|1>: pliega (0) o abre (1) el panel izquierdo
	if (Verbo == TEXT("panel")) { bPanelPlegado = Resto == TEXT("0"); return true; }
	// texto <90|100|125|150>: «Tamaño del texto» (se guarda en la configuración del usuario, como al pulsar el botón)
	if (Verbo == TEXT("texto")) { PonerTamTexto(FCString::Atoi(*Resto)); Reconstruir(); return true; }
	// movimiento <0|1>: abre (1) o cierra (0) el panel de movimiento, como el botón «Movimiento» del panel izquierdo
	if (Verbo == TEXT("movimiento"))
	{
		ACorpusCuerpo* C = Cuerpo();
		bVerMov = Resto != TEXT("0");
		if (C && !bVerMov) { C->PonerMarcha(-1, 0.f); C->PonerEjercicio(-1, 0, 0.f); C->QuitarPostura(); }
		Reconstruir();
		return true;
	}
	// esc: lo mismo que la tecla Esc (resultados → ficha → Estudiar)
	if (Verbo == TEXT("esc")) { if (!CerrarConEsc()) { if (ACorpusCuerpo* C = Cuerpo()) { C->MostrarTodo(); } } return true; }
	// animlenta <factor>: ralentiza las animaciones de la interfaz (1 = normal) para fotografiarlas a mitad de camino
	if (Verbo == TEXT("animlenta")) { EscalaAnim = FMath::Clamp(FCString::Atof(*Resto), 0.01f, 1.f); return true; }
	// tecnica <0|1>: en el modo «Ejercicio», la lista de músculos (0) o los textos de técnica y errores (1)
	if (Verbo == TEXT("tecnica")) { bEjTecnica = Resto != TEXT("0"); RehacerMovimiento(); return true; }
	// enlace <n>: pulsa el enésimo botón «Estudiar» de la ficha de la pieza seleccionada
	if (Verbo == TEXT("enlace"))
	{
		const int32 N = FCString::Atoi(*Resto);
		if (EnlacesFicha.IsValidIndex(N)) { const FIntVector4 E = EnlacesFicha[N]; AbrirEnlace(E); }
		return true;
	}
	// relieve <todos|off|n|texto>: marca los relieves del hueso seleccionado (n = número en la lista de la ficha, desde 0;
	// texto = parte de su nombre en español o inglés)
	if (Verbo == TEXT("relieve"))
	{
		UCorpusDatos* D = Datos(); ACorpusCuerpo* C = Cuerpo();
		TArray<int32> Cuales;
		const TArray<FCorpusRelieve> Vacio;
		const TArray<FCorpusRelieve>& Rs = (D && C) ? D->Relieves(C->Seleccionada()) : Vacio;
		if (Resto == TEXT("todos")) { for (int32 i = 0; i < Rs.Num(); ++i) { Cuales.Add(i); } }
		else if (Resto.IsNumeric()) { Cuales.Add(FCString::Atoi(*Resto)); }
		else if (Resto != TEXT("off") && !Resto.IsEmpty())
		{
			const FString Q = UCorpusDatos::Plano(Resto);
			for (int32 i = 0; i < Rs.Num() && Cuales.Num() == 0; ++i) { if (UCorpusDatos::Plano(Rs[i].Es).Contains(Q) || UCorpusDatos::Plano(Rs[i].En).Contains(Q)) { Cuales.Add(i); } }
		}
		VerRelieves(Cuales, Cuales.Num() == 1);
		return true;
	}
	return false;
}

void SCorpusInterfaz::RehacerFicha()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaFicha.IsValid()) { return; }
	const FString Id = C->Seleccionada();
	const FCorpusPieza* P = D->Pieza(Id);
	// las marcas de relieves son del hueso seleccionado: al cambiar de pieza se quitan (y el fantasma que encendieron).
	// Antes de vaciar la ficha: apagar el fantasma vuelve a llamar aquí.
	if (Id != RelHueso)
	{
		RelHueso = Id; RelVistos.Reset();
		if (bFantasmaPorRelieves) { bFantasmaPorRelieves = false; C->Fantasma(false); }
	}
	CajaFicha->ClearChildren();
	ActualizarMarcas();
	if (!P) { return; }
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	TWeakObjectPtr<ACorpusJugador> WJ(Jugador);

	CajaFicha->AddSlot().AutoHeight()[ Txt(D->NombrePieza(Id), T_TITULO, C_TINTA, EPeso::Negrita) ];
	if (!P->La.IsEmpty()) { CajaFicha->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(P->La, T_NOTA, C_GRIS) ]; }
	FString Sub = D->NombreCapa(P->Sistema);
	if (!P->Lado.IsEmpty()) { Sub += TEXT(" · ") + D->NombreLado(P->Lado); }
	if (!P->Rol.IsEmpty()) { Sub += TEXT(" · ") + D->T(UCorpusDatos::EsOrigen(*P) ? TEXT("Origen") : TEXT("Inserción")); }   // áreas de la capa «insercion»
	CajaFicha->AddSlot().AutoHeight().Padding(0, E_2, 0, E_3)[ Txt(Sub, T_SECUNDARIO, C_GRIS, EPeso::Media) ];

	TSharedRef<SWrapBox> Acciones = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO))
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Encuadrar")), [WJ]() { if (WJ.IsValid()) { WJ->EncuadrarSeleccion(); } }, ECorpusBoton::Principal) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Aislar")), [WC, Id]() { if (WC.IsValid()) { WC->Aislar(Id); } }) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Ocultar")), [WC, Id]() { if (WC.IsValid()) { WC->Ocultar(Id); } }) ];
	// mapa de origen (rojo) e inserción (azul) del hueso o del músculo seleccionado
	const bool bMapa = C->EnMapaInserciones();
	if (bMapa || C->TieneInserciones(Id))
	{
		Acciones->AddSlot()[ BotonSel(D->T(TEXT("Orígenes e inserciones")), [WC]() { if (WC.IsValid()) { WC->MapaInserciones(!WC->EnMapaInserciones()); } }, bMapa) ];
	}
	CajaFicha->AddSlot().AutoHeight()[ Acciones ];
	if (bMapa)
	{
		// leyenda: qué músculos nacen (rojo) y cuáles terminan (azul) en las áreas encendidas
		TArray<FString> Nombres[2];
		for (const FString& A : C->AreasDelMapa()) { if (const FCorpusPieza* Pa = D->Pieza(A)) { Nombres[UCorpusDatos::EsOrigen(*Pa) ? 0 : 1].AddUnique(D->NombrePieza(A)); } }
		const TCHAR* Titulos[2] = { TEXT("Origen"), TEXT("Inserción") };
		const FLinearColor Colores[2] = { ACorpusCuerpo::ColorOrigen(), ACorpusCuerpo::ColorInsercion() };
		for (int32 k = 0; k < 2; ++k)
		{
			if (Nombres[k].Num() == 0) { continue; }
			Nombres[k].Sort();
			CajaFicha->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, E_2, 0)[ SNew(SBox).WidthOverride(12.f).HeightOverride(12.f)[ SNew(SImage).Image(Punto()).ColorAndOpacity(Colores[k]) ] ]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Etiqueta(FString::Printf(TEXT("%s (%d)"), *D->T(Titulos[k]), Nombres[k].Num())) ]
			];
			CajaFicha->AddSlot().AutoHeight()[ Txt(FString::Join(Nombres[k], TEXT(" · ")), T_CUERPO, C_TINTA) ];
		}
	}

	// vínculo con Estudiar: un botón por cada entrada del glosario, de patologías o de lecciones que nombra esta estructura
	EnlacesFicha.Reset();
	if (!bVerEst && P->Sistema != TEXT("insercion"))
	{
		const TArray<FIntVector4>& Todas = EnlacesDe(P->En);
		// por turnos entre módulos (glosario, patologías, lecciones): que los diez primeros no sean todos del glosario
		TArray<FIntVector4> Es;
		{
			TArray<TArray<FIntVector4>> PorModulo;
			for (const FIntVector4& En : Todas) { if (PorModulo.Num() == 0 || PorModulo.Last()[0].X != En.X) { PorModulo.AddDefaulted(); } PorModulo.Last().Add(En); }
			for (int32 k = 0; Es.Num() < Todas.Num(); ++k) { for (const TArray<FIntVector4>& L : PorModulo) { if (L.IsValidIndex(k)) { Es.Add(L[k]); } } }
		}
		if (Es.Num() > 0)
		{
			const FCorpusEstudio& E = D->Estudio();
			const int32 MAXIMO = 10;
			CajaFicha->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(FString::Printf(TEXT("%s (%d)"), *D->TE(TEXT("Estudiar")), Es.Num())) ];
			for (int32 k = 0; k < Es.Num() && k < MAXIMO; ++k)
			{
				const FIntVector4 En = Es[k];
				const FCorpusModuloEstudio& M = E.Modulos[En.X];
				const FCorpusItemEstudio& It = M.Grupos[En.Y].Items[En.Z];
				EnlacesFicha.Add(En);
				CajaFicha->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)
				[
					BotonFila(SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight()[ Txt(It.T, T_NOTA, C_TINTA) ]
						+ SVerticalBox::Slot().AutoHeight()[ Txt(M.N + (M.Grupos.Num() > 1 ? TEXT(" · ") + M.Grupos[En.Y].N : FString()), T_SECUNDARIO, C_GRIS) ],
						[this, En]() { AbrirEnlace(En); })
				];
			}
			if (Es.Num() > MAXIMO) { CajaFicha->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(FString::Printf(TEXT("+ %d"), Es.Num() - MAXIMO), T_SECUNDARIO, C_GRIS) ]; }
		}
	}

	// relieves óseos (data/extras.json → lm): uno por botón; se marcan sobre el hueso con su nombre
	const TArray<FCorpusRelieve>& Rs = D->Relieves(Id);
	if (Rs.Num() > 0)
	{
		CajaFicha->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(FString::Printf(TEXT("%s (%d)"), *D->T(TEXT("Accidentes óseos")), Rs.Num())) ];
		TArray<int32> Todos; for (int32 i = 0; i < Rs.Num(); ++i) { Todos.Add(i); }
		CajaFicha->AddSlot().AutoHeight()
		[
			SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO))
			+ SWrapBox::Slot()[ BotonSel(D->T(TEXT("Mostrar todos")), [this, Todos]() { VerRelieves(Todos, false); }, RelVistos.Num() == Rs.Num()) ]
			+ SWrapBox::Slot()[ Boton(D->T(TEXT("Ocultar marcas")), [this]() { VerRelieves(TArray<int32>(), false); }) ]
		];
		TSharedRef<SWrapBox> Lista = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
		for (int32 i = 0; i < Rs.Num(); ++i)
		{
			Lista->AddSlot()[ BotonSel(D->NombreRelieve(Rs[i]), [this, i]() { VerRelieves(TArray<int32>({ i }), true); }, RelVistos.Num() < Rs.Num() && RelVistos.Contains(i)) ];
		}
		CajaFicha->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Lista ];
	}

	// campos de la ficha (descripción, relaciones, clínica…): lectura larga y notas clínicas a 11 pt
	for (const TPair<FString, FString>& Campo : D->Ficha(Id))
	{
		CajaFicha->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(Campo.Key) ];
		CajaFicha->AddSlot().AutoHeight()[ Txt(Campo.Value, T_NOTA, C_TINTA) ];
	}
}

const TArray<FIntVector4>& SCorpusInterfaz::EnlacesDe(const FString& En)
{
	static const TArray<FIntVector4> Nada;
	UCorpusDatos* D = Datos();
	if (!D) { return Nada; }
	if (EnlacesIdioma != D->Idioma())
	{
		// índice nombre en inglés → entradas, una vez por idioma (la primera vez lee estudio_<idioma>.json)
		EnlacesIdioma = D->Idioma();
		Enlaces.Reset();
		const FCorpusEstudio& E = D->Estudio();
		for (const TCHAR* Mod : { TEXT("glosario"), TEXT("patologias"), TEXT("lecciones") })   // en este orden en la ficha
		{
			for (int32 m = 0; m < E.Modulos.Num(); ++m)
			{
				if (E.Modulos[m].Id != Mod) { continue; }
				for (int32 g = 0; g < E.Modulos[m].Grupos.Num(); ++g)
				{
					const TArray<FCorpusItemEstudio>& Its = E.Modulos[m].Grupos[g].Items;
					for (int32 i = 0; i < Its.Num(); ++i)
					{
						TSet<FString> Vistos;
						for (const FString& S : Its[i].Show) { if (!Vistos.Contains(S)) { Vistos.Add(S); Enlaces.FindOrAdd(S).Add(FIntVector4(m, g, i, 0)); } }
						for (int32 p = 0; p < Its[i].Pasos.Num(); ++p)
						{
							for (const FString& S : Its[i].Pasos[p].Show) { if (!Vistos.Contains(S)) { Vistos.Add(S); Enlaces.FindOrAdd(S).Add(FIntVector4(m, g, i, p)); } }
						}
					}
				}
			}
		}
	}
	const TArray<FIntVector4>* L = Enlaces.Find(En);
	return L ? *L : Nada;
}

void SCorpusInterfaz::AbrirEnlace(const FIntVector4& E)
{
	// abre Estudiar en esa entrada (y en el paso que nombra la estructura); el panel enseña después la entrada en el modelo
	EstMod = E.X; EstGrupo = E.Y; EstItem = E.Z; EstPaso = E.W;
	EstFiltro.Reset(); EstResp.Reset();
	if (bVerEst) { RehacerEstudio(); EnsenarEstudio(); } else { AbrirEstudio(true); }
	if (RolloEst.IsValid()) { RolloEst->ScrollToStart(); }
}

void SCorpusInterfaz::ActualizarMarcas()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!Marcas.IsValid()) { return; }
	Marcas->Puntos.Reset();
	if (!D || !C || bVerEst) { return; }
	const TArray<FCorpusRelieve>& Rs = D->Relieves(RelHueso);
	for (const int32 i : RelVistos) { if (Rs.IsValidIndex(i)) { Marcas->Puntos.Emplace(C->PuntoMundo(Rs[i].Pos), D->NombreRelieve(Rs[i])); } }
}

void SCorpusInterfaz::VerRelieves(const TArray<int32>& Cuales, bool bEnfocar)
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C) { return; }
	RelHueso = C->Seleccionada();
	RelVistos = Cuales;
	// como la web (rayos X al enseñar relieves): lo que tapa el hueso pasa a fantasma mientras haya marcas
	if (Cuales.Num() > 0 && !C->EnFantasma()) { bFantasmaPorRelieves = true; C->Fantasma(true); }
	else if (Cuales.Num() == 0 && bFantasmaPorRelieves) { bFantasmaPorRelieves = false; C->Fantasma(false); }
	const TArray<FCorpusRelieve>& Rs = D->Relieves(RelHueso);
	ACorpusCamara* Cam = Jugador.IsValid() ? Jugador->CamaraOrbital() : nullptr;
	if (bEnfocar && Cam && Cuales.Num() == 1 && Rs.IsValidIndex(Cuales[0]))
	{
		// la cámara se acerca al relieve (unos 9 cm alrededor)
		Cam->Encuadrar(FBox::BuildAABB(C->PuntoMundo(Rs[Cuales[0]].Pos), FVector(9.0)));
	}
	RehacerFicha();
}

void SCorpusInterfaz::QaBuscar(const FString& Texto)
{
	if (Buscador.IsValid()) { Buscador->SetText(FText::FromString(Texto)); }
	RehacerResultados(FText::FromString(Texto));
}

void SCorpusInterfaz::RehacerResultados(const FText& Texto)
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaResultados.IsValid()) { return; }
	CajaResultados->ClearChildren();
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	TWeakObjectPtr<ACorpusJugador> WJ(Jugador);
	for (const FString& Id : D->Buscar(Texto.ToString(), 30))
	{
		const FCorpusPieza* P = D->Pieza(Id);
		if (!P || !C->CapaDisponible(P->Sistema)) { continue; }
		FString Nombre = D->NombrePieza(Id);
		if (!P->Lado.IsEmpty()) { Nombre += TEXT(" · ") + D->NombreLado(P->Lado); }
		const FString Sistema = P->Sistema;
		CajaResultados->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)
		[
			BotonFila(SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()[ Txt(Nombre, T_NOTA, C_TINTA) ]
				+ SVerticalBox::Slot().AutoHeight()[ Txt(D->NombreCapa(Sistema), T_SECUNDARIO, C_GRIS) ],
				[WC, WJ, Id, Sistema]()
				{
					if (WC.IsValid())
					{
						// como en la web: buscar enciende la capa de la estructura, la selecciona y la encuadra
						WC->MostrarCapa(Sistema, true);
						WC->Seleccionar(Id);
						if (WJ.IsValid()) { WJ->EncuadrarSeleccion(); }
					}
				})
		];
	}
}

// ───────── Panel de estudio ─────────

const FCorpusItemEstudio* SCorpusInterfaz::ItemEstudio() const
{
	UCorpusDatos* D = Datos();
	if (!D) { return nullptr; }
	const FCorpusEstudio& E = D->Estudio();
	if (!E.Modulos.IsValidIndex(EstMod) || !E.Modulos[EstMod].Grupos.IsValidIndex(EstGrupo)) { return nullptr; }
	const FCorpusGrupoEstudio& G = E.Modulos[EstMod].Grupos[EstGrupo];
	return G.Items.IsValidIndex(EstItem) ? &G.Items[EstItem] : nullptr;
}

void SCorpusInterfaz::AbrirEstudio(bool bSi)
{
	bVerEst = bSi;
	if (ACorpusCuerpo* C = Cuerpo())
	{
		if (bSi) { bVerMov = false; C->Seleccionar(FString()); }
		else
		{
			C->RestaurarEstado();
			// la cámara vuelve al cuerpo entero, de frente
			if (ACorpusCamara* Cam = Jugador.IsValid() ? Jugador->CamaraOrbital() : nullptr) { Cam->Vista(0); Cam->Encuadrar(C->Caja(FString())); }
		}
	}
	Reconstruir();
	if (bSi) { EnsenarEstudio(); }
}

void SCorpusInterfaz::EnsenarEstudio()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	const FCorpusItemEstudio* It = ItemEstudio();
	if (!D || !C || !It || !bVerEst) { return; }
	ACorpusCamara* Cam = Jugador.IsValid() ? Jugador->CamaraOrbital() : nullptr;
	const auto Encuadrar = [C, Cam](const TArray<FString>& Ids, int32 Vista)
	{
		if (!Cam) { return; }
		if (Vista >= 0) { Cam->Vista(Vista); }
		FBox B(ForceInit);
		for (const FString& Id : Ids) { const FBox Bi = C->Caja(Id); if (Bi.IsValid) { B += Bi; } }
		if (!B.IsValid) { B = C->Caja(FString()); }
		Cam->Encuadrar(B);
	};
	C->GuardarEstado();
	if (It->Pasos.IsValidIndex(EstPaso))
	{
		const FCorpusPasoEstudio& P = It->Pasos[EstPaso];
		if (!P.Ver.IsEmpty())
		{
			// recorrido: lo mismo que enseña la web en ese paso
			if (const FCorpusVistaPaso* V = D->VistaDePaso(P.Ver))
			{
				C->PonerVista(*V);
				if (Cam) { Cam->OrbitaWeb(V->Tgt, V->R, V->Th, V->Ph); }
			}
			return;
		}
		if (P.Show.Num() > 0)
		{
			const TArray<FString> Ids = C->IdsDeNombres(P.Show, It->Lado);
			if (Ids.Num() > 0) { C->Ensenar(Ids, It->Capas); Encuadrar(Ids, P.Vista); }
			return;
		}
	}
	if (It->Show.Num() > 0 || It->Capas.Num() > 0)
	{
		const TArray<FString> Ids = C->IdsDeNombres(It->Show, It->Lado);
		if (Ids.Num() > 0 || It->Show.Num() == 0) { C->Ensenar(Ids, It->Capas); Encuadrar(Ids, It->Vista); }
	}
}

void SCorpusInterfaz::RehacerEstudio()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaEst.IsValid() || !CajaEstCab.IsValid()) { return; }
	CajaEst->ClearChildren();
	CajaEstCab->ClearChildren();
	if (!bVerEst) { return; }
	const FCorpusEstudio& E = D->Estudio();
	if (E.Modulos.Num() == 0)
	{
		CajaEst->AddSlot().AutoHeight()[ Txt(TEXT("Faltan los datos de estudio: node tools/unreal/estudio.js"), T_NOTA, C_GRIS) ];
		return;
	}
	EstMod = FMath::Clamp(EstMod, 0, E.Modulos.Num() - 1);
	const FCorpusModuloEstudio& M = E.Modulos[EstMod];
	TWeakObjectPtr<ACorpusCuerpo> WC(C);

	// fila ancha con el texto a la izquierda (entradas de las listas)
	// Respuesta: 0 sin corregir · 1 la correcta · 2 la elegida y equivocada (verde y rojo solo en el borde)
	const auto Fila = [](const FString& Titulo, const FString& Sub, TFunction<void()> Accion, int32 Respuesta = 0) -> TSharedRef<SWidget>
	{
		TSharedRef<SVerticalBox> V = SNew(SVerticalBox) + SVerticalBox::Slot().AutoHeight()[ Txt(Titulo, T_NOTA, C_TINTA) ];
		if (!Sub.IsEmpty()) { V->AddSlot().AutoHeight()[ Txt(Sub, T_SECUNDARIO, C_GRIS) ]; }
		return BotonFila(V, MoveTemp(Accion), Respuesta == 0 ? nullptr : &EstiloRespuesta(Respuesta == 1));
	};
	const auto Ir = [this](int32 Grupo, int32 Item)
	{
		const bool bSalir = EstItem >= 0 && Item < 0;
		EstGrupo = Grupo; EstItem = Item; EstPaso = 0; EstResp.Reset();
		if (bSalir)
		{
			if (ACorpusCuerpo* Cu = Cuerpo())
			{
				Cu->RestaurarEstado();
				if (ACorpusCamara* Cam = Jugador.IsValid() ? Jugador->CamaraOrbital() : nullptr) { Cam->Vista(0); Cam->Encuadrar(Cu->Caja(FString())); }
			}
		}
		RehacerEstudio();
		if (RolloEst.IsValid()) { RolloEst->ScrollToStart(); }
		EnsenarEstudio();
	};

	// ── cabecera: título, cerrar y módulos ──
	CajaEstCab->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(Mayus(D->TE(TEXT("Estudiar"))), T_SECCION, C_TINTA, EPeso::Negrita) ]
		+ SHorizontalBox::Slot().AutoWidth()[ Boton(D->TE(TEXT("Cerrar")), [this]() { AbrirEstudio(false); }) ]
	];
	TSharedRef<SWrapBox> Mods = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO));
	for (int32 i = 0; i < E.Modulos.Num(); ++i)
	{
		Mods->AddSlot()[ BotonSel(E.Modulos[i].N, [this, i, Ir]() { EstMod = i; EstFiltro.Reset(); Ir(-1, -1); }, i == EstMod) ];
	}
	CajaEstCab->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Mods ];

	const FCorpusItemEstudio* It = ItemEstudio();
	if (!It)
	{
		// ── listas: buscador, grupos y entradas ──
		CajaEstCab->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)
		[
			SNew(SEditableTextBox).Style(&EstiloCampo()).HintText(FText::FromString(D->TE(TEXT("Buscar")))).Text(FText::FromString(EstFiltro))
			.OnTextCommitted_Lambda([this](const FText& T, ETextCommit::Type) { const FString S = T.ToString().TrimStartAndEnd(); if (S != EstFiltro) { EstFiltro = S; EstGrupo = -1; EstItem = -1; RehacerEstudio(); } })
		];
		if (EstFiltro.Len() >= 2)
		{
			const FString Q = UCorpusDatos::Plano(EstFiltro);
			int32 N = 0;
			for (int32 g = 0; g < M.Grupos.Num() && N < 80; ++g)
			{
				for (int32 i = 0; i < M.Grupos[g].Items.Num() && N < 80; ++i)
				{
					const FCorpusItemEstudio& X = M.Grupos[g].Items[i];
					if (!UCorpusDatos::Plano(X.T).Contains(Q) && !UCorpusDatos::Plano(X.Sub).Contains(Q)) { continue; }
					CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Fila(X.T, M.Grupos[g].N, [Ir, g, i]() { Ir(g, i); }) ];
					++N;
				}
			}
			if (N == 0) { CajaEst->AddSlot().AutoHeight().Padding(0, E_2)[ Txt(D->TE(TEXT("Nada")), T_NOTA, C_GRIS) ]; }
			return;
		}
		const bool bUnGrupo = M.Grupos.Num() == 1;
		if (!M.Grupos.IsValidIndex(EstGrupo) && !bUnGrupo)
		{
			for (int32 g = 0; g < M.Grupos.Num(); ++g)
			{
				CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)
				[ Fila(M.Grupos[g].N, FString::Printf(TEXT("%d %s"), M.Grupos[g].Items.Num(), *D->TE(TEXT("Entradas"))), [Ir, g]() { Ir(g, -1); }) ];
			}
			if (M.Id == TEXT("patologias") && !E.Aviso.IsEmpty()) { CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ Txt(E.Aviso, T_SECUNDARIO, C_GRIS) ]; }
			return;
		}
		const int32 g = bUnGrupo ? 0 : EstGrupo;
		if (!bUnGrupo)
		{
			CajaEst->AddSlot().AutoHeight()[ SNew(SHorizontalBox) + SHorizontalBox::Slot().AutoWidth()[ Boton(D->TE(TEXT("Volver")), [Ir]() { Ir(-1, -1); }) ] ];
			CajaEst->AddSlot().AutoHeight().Padding(0, E_2, 0, E_1)[ Txt(M.Grupos[g].N, T_SECCION, C_TINTA, EPeso::Media) ];
		}
		for (int32 i = 0; i < M.Grupos[g].Items.Num(); ++i)
		{
			const FCorpusItemEstudio& X = M.Grupos[g].Items[i];
			CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Fila(X.T, X.Sub, [Ir, g, i]() { Ir(g, i); }) ];
		}
		return;
	}

	// ── ficha de una entrada ──
	// una sola acción principal por panel: «Siguiente» si la entrada tiene pasos; si no, «Ver»
	const int32 gAct = EstGrupo;
	const bool bUnSolo = M.Grupos.Num() == 1;
	const bool bConPasos = It->Pasos.Num() > 1;
	CajaEst->AddSlot().AutoHeight()
	[
		SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(HUECO, HUECO))
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Volver")), [this, Ir, gAct, bUnSolo]() { Ir((EstFiltro.Len() >= 2 || bUnSolo) ? -1 : gAct, -1); }) ]
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Ver")), [this]() { EnsenarEstudio(); }, bConPasos ? ECorpusBoton::Normal : ECorpusBoton::Principal) ]
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Todo")), [WC]() { if (WC.IsValid()) { WC->RestaurarEstado(); WC->MostrarTodo(); } }) ]
	];
	CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ Txt(It->T, T_TITULO, C_TINTA, EPeso::Negrita) ];
	FString Sub = M.Grupos[EstGrupo].N;
	if (!It->Sub.IsEmpty()) { Sub += TEXT(" · ") + It->Sub; }
	CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(Sub, T_SECUNDARIO, C_GRIS, EPeso::Media) ];

	// ilustración (patologías): imagen con licencia abierta y su atribución
	if (!It->Img.IsEmpty())
	{
		if (EstImg != It->Img || !EstTex.IsValid())
		{
			EstImg = It->Img;
			EstTex.Reset(FImageUtils::ImportFileAsTexture2D(FPaths::Combine(UCorpusDatos::CarpetaDatos(), TEXT("estudio_img"), It->Img)));
			EstPincel = MakeShared<FSlateBrush>();
			if (EstTex.IsValid())
			{
				EstPincel->SetResourceObject(EstTex.Get());
				EstPincel->ImageSize = FVector2D(EstTex->GetSizeX(), EstTex->GetSizeY());
			}
		}
		if (EstTex.IsValid() && EstPincel.IsValid())
		{
			const float Prop = (float)EstTex->GetSizeY() / FMath::Max(1, EstTex->GetSizeX());
			const float Alto = FMath::Min(448.f * Prop, 520.f);   // ancho útil del panel: 500 − 2 × 20 de relleno − la barra de desplazamiento
			CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, 0).HAlign(HAlign_Left)
			[
				SNew(SBox).WidthOverride(Alto / FMath::Max(Prop, 0.01f)).HeightOverride(Alto)[ SNew(SImage).Image(EstPincel.Get()) ]
			];
			CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(D->TE(TEXT("Imagen")) + TEXT(": ") + It->Cred, T_SECUNDARIO, C_GRIS) ];
		}
	}

	// pasos (lecciones y recorridos)
	if (It->Pasos.Num() > 0)
	{
		EstPaso = FMath::Clamp(EstPaso, 0, It->Pasos.Num() - 1);
		const FCorpusPasoEstudio& P = It->Pasos[EstPaso];
		const int32 NP = It->Pasos.Num();
		TSharedRef<SVerticalBox> Caja = SNew(SVerticalBox);
		Caja->AddSlot().AutoHeight()[ Etiqueta(FString::Printf(TEXT("%s %d / %d"), *D->TE(TEXT("Paso")), EstPaso + 1, NP)) ];
		Caja->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(P.T, T_SECCION, C_TINTA, EPeso::Media) ];
		Caja->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(P.X, T_NOTA, C_TINTA) ];
		const auto IrPaso = [this](int32 Paso) { EstPaso = Paso; RehacerEstudio(); EnsenarEstudio(); };
		TSharedRef<SHorizontalBox> Nav = SNew(SHorizontalBox);
		if (EstPaso > 0) { Nav->AddSlot().AutoWidth().Padding(0, 0, HUECO, 0)[ Boton(D->TE(TEXT("Anterior")), [IrPaso, this]() { IrPaso(EstPaso - 1); }) ]; }
		if (EstPaso < NP - 1) { Nav->AddSlot().AutoWidth()[ Boton(D->TE(TEXT("Siguiente")), [IrPaso, this]() { IrPaso(EstPaso + 1); }, ECorpusBoton::Principal) ]; }
		Caja->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ Nav ];
		CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ SNew(SBorder).BorderImage(Tarjeta()).Padding(E_3)[ Caja ] ];
	}

	for (const TPair<FString, FString>& S : It->Secs)
	{
		CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Etiqueta(S.Key) ];
		CajaEst->AddSlot().AutoHeight()[ Txt(S.Value, T_NOTA, C_TINTA) ];
	}

	// preguntas (verde y rojo solo en el borde de la opción y en el rótulo «Correcto» / «Incorrecto»)
	if (It->Q.Num() > 0)
	{
		CajaEst->AddSlot().AutoHeight().Padding(0, E_4, 0, E_1)[ Etiqueta(D->TE(TEXT("Preguntas"))) ];
		int32 Aciertos = 0, Hechas = 0;
		for (int32 q = 0; q < It->Q.Num(); ++q)
		{
			const FCorpusPregunta& Q = It->Q[q];
			const int32* Elegida = EstResp.Find(q);
			if (Elegida) { ++Hechas; if (*Elegida == Q.A) { ++Aciertos; } }
			CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, E_1)[ Txt(It->Q.Num() > 1 ? FString::Printf(TEXT("%d. %s"), q + 1, *Q.P) : Q.P, T_SECCION, C_TINTA, EPeso::Media) ];
			for (int32 o = 0; o < Q.O.Num(); ++o)
			{
				const int32 Resp = !Elegida ? 0 : o == Q.A ? 1 : o == *Elegida ? 2 : 0;
				CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Fila(Q.O[o], FString(), [this, q, o]() { if (!EstResp.Contains(q)) { EstResp.Add(q, o); RehacerEstudio(); } }, Resp) ];
			}
			if (Elegida)
			{
				const bool bBien = *Elegida == Q.A;
				CajaEst->AddSlot().AutoHeight().Padding(0, E_2, 0, 0)[ Txt(D->TE(bBien ? TEXT("Correcto") : TEXT("Incorrecto")), T_CUERPO, bBien ? C_BIEN : C_MAL, EPeso::Negrita) ];
				if (!Q.X.IsEmpty()) { CajaEst->AddSlot().AutoHeight().Padding(0, E_1, 0, 0)[ Txt(Q.X, T_NOTA, C_TINTA) ]; }
			}
		}
		if (It->Q.Num() > 1 && Hechas == It->Q.Num())
		{
			CajaEst->AddSlot().AutoHeight().Padding(0, E_3, 0, 0)[ Txt(FString::Printf(TEXT("%s: %d / %d"), *D->TE(TEXT("Aciertos")), Aciertos, It->Q.Num()), T_SECCION, C_TINTA, EPeso::Negrita) ];
		}
	}
	if (M.Id == TEXT("patologias") || M.Id == TEXT("casos") || M.Id == TEXT("protocolos")) { CajaEst->AddSlot().AutoHeight().Padding(0, E_4, 0, 0)[ Txt(E.Aviso, T_SECUNDARIO, C_GRIS) ]; }
}

void SCorpusInterfaz::QaEstudio(const FString& Args)
{
	UCorpusDatos* D = Datos();
	TArray<FString> A; Args.ParseIntoArrayWS(A);
	if (!D || A.Num() == 0) { AbrirEstudio(false); return; }
	if (A[0] == TEXT("responder"))
	{
		if (A.Num() > 2) { EstResp.Add(FCString::Atoi(*A[1]), FCString::Atoi(*A[2])); RehacerEstudio(); if (RolloEst.IsValid()) { RolloEst->ScrollToEnd(); } }
		return;
	}
	if (A[0] == TEXT("bajar")) { if (RolloEst.IsValid()) { RolloEst->SetScrollOffset(A.Num() > 1 ? FCString::Atof(*A[1]) : 400.f); } return; }
	const FCorpusEstudio& E = D->Estudio();
	for (int32 i = 0; i < E.Modulos.Num(); ++i) { if (E.Modulos[i].Id == A[0]) { EstMod = i; } }
	EstFiltro.Reset(); EstGrupo = -1; EstItem = -1; EstPaso = 0; EstResp.Reset();
	if (A.Num() > 2 && A[1] == TEXT("buscar")) { EstFiltro = A[2]; }
	else
	{
		if (A.Num() > 1) { EstGrupo = FCString::Atoi(*A[1]); }
		if (A.Num() > 2) { EstItem = FCString::Atoi(*A[2]); }
		if (A.Num() > 3) { EstPaso = FCString::Atoi(*A[3]); }
	}
	if (ACorpusCuerpo* C = Cuerpo()) { C->RestaurarEstado(); }
	if (!bVerEst) { AbrirEstudio(true); } else { RehacerEstudio(); EnsenarEstudio(); }
}