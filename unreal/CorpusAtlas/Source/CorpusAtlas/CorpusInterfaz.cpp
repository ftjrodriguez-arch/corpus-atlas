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

	// Mismos tonos que el tema oscuro de la web (--bg, --panel, --ink, --muted, --accent).
	const FLinearColor C_PANEL(0.012f, 0.016f, 0.022f, 0.90f);
	const FLinearColor C_PANEL2(0.035f, 0.045f, 0.060f, 1.f);
	const FLinearColor C_TINTA(0.90f, 0.92f, 0.95f);
	const FLinearColor C_GRIS(0.50f, 0.55f, 0.62f);
	const FLinearColor C_ACENTO(0.10f, 0.55f, 1.0f);

	const FSlateBrush* Panel() { static const FSlateRoundedBoxBrush B(C_PANEL, 14.f); return &B; }
	const FSlateBrush* Panel2() { static const FSlateRoundedBoxBrush B(C_PANEL2, 8.f); return &B; }
	const FSlateBrush* Punto() { static const FSlateRoundedBoxBrush B(FLinearColor::White, 6.f); return &B; }
	FSlateFontInfo Letra(int32 Tam, bool bNegrita = false) { return FCoreStyle::GetDefaultFontStyle(bNegrita ? "Bold" : "Regular", Tam); }

	TSharedRef<STextBlock> Txt(const FString& S, int32 Tam, const FLinearColor& Col, bool bNegrita = false)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Letra(Tam, bNegrita)).ColorAndOpacity(FSlateColor(Col)).AutoWrapText(true);
	}
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

	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& Recorte, FSlateWindowElementList& Fuera, int32 Capa, const FWidgetStyle& Estilo, bool bActivo) const override
	{
		const ACorpusJugador* J = Jugador.Get();
		const ACorpusCuerpo* Cu = J ? J->Cuerpo() : nullptr;
		int32 VX = 0, VY = 0;
		if (J) { J->GetViewportSize(VX, VY); }
		if (!Cu || Puntos.Num() == 0 || VX < 2 || VY < 2 || Cu->HayPostura()) { return Capa; }   // las marcas son de reposo
		const FVector2D Tam = G.GetLocalSize();
		const FVector2D Esc(Tam.X / VX, Tam.Y / VY);
		const FSlateFontInfo Fuente = Letra(Puntos.Num() == 1 ? 12 : 9, true);
		const TSharedRef<FSlateFontMeasure> Medir = FSlateApplication::Get().GetRenderer()->GetFontMeasureService();
		const FLinearColor Amarillo(FColor::FromHex(TEXT("ffd34d")));

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
			const FVector2D Caja = M.T + FVector2D(12, 6);
			FSlateDrawElement::MakeBox(Fuera, Capa + 1, G.ToPaintGeometry(Caja, FSlateLayoutTransform(Pos)), Panel2(), ESlateDrawEffect::None, FLinearColor(0.02f, 0.03f, 0.045f, 0.92f));   // el color pasado sustituye al del pincel
			FSlateDrawElement::MakeText(Fuera, Capa + 2, G.ToPaintGeometry(M.T, FSlateLayoutTransform(Pos + FVector2D(6, 3))), M.S, Fuente, ESlateDrawEffect::None, C_TINTA);
		};
		const auto Punto8 = [&](const FVector2D& P)
		{
			FSlateDrawElement::MakeBox(Fuera, Capa + 3, G.ToPaintGeometry(FVector2D(12, 12), FSlateLayoutTransform(P - FVector2D(6, 6))), Punto(), ESlateDrawEffect::None, FLinearColor(0, 0, 0, 0.8f));
			FSlateDrawElement::MakeBox(Fuera, Capa + 4, G.ToPaintGeometry(FVector2D(8, 8), FSlateLayoutTransform(P - FVector2D(4, 4))), Punto(), ESlateDrawEffect::None, Amarillo);
		};
		if (Ms.Num() == 1)
		{
			Punto8(Ms[0].P);
			Rotulo(Ms[0], Ms[0].P + FVector2D(14, -Ms[0].T.Y * 0.5 - 3));
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
			Corr = FMath::Clamp(Corr, 74.0 - Ys[0], FMath::Max(74.0 - Ys[0], Tam.Y - Paso - Ys.Last()));   // por debajo del buscador
			const double XCol = Lado == 0 ? FMath::Max(MinX - 70.0, 360.0) : FMath::Min(MaxX + 70.0, Tam.X - 430.0);
			for (int32 i = 0; i < Col.Num(); ++i)
			{
				const FM& M = *Col[i];
				const double Y = Ys[i] + Corr;
				const FVector2D Pos(Lado == 0 ? XCol - M.T.X - 12.0 : XCol, Y - M.T.Y * 0.5 - 3.0);
				const FVector2D Ancla(XCol, Y);
				FSlateDrawElement::MakeLines(Fuera, Capa, G.ToPaintGeometry(), TArray<FVector2f>({ FVector2f(M.P), FVector2f(Ancla) }), ESlateDrawEffect::None, FLinearColor(1.f, 0.83f, 0.30f, 0.75f), true, 1.2f);
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

	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& G, const FSlateRect& Recorte, FSlateWindowElementList& Fuera, int32 Capa, const FWidgetStyle& Estilo, bool bActivo) const override
	{
		const ACorpusCuerpo* Cu = Cuerpo.Get();
		if (!Cu || Cu->Rango() < 0) { return Capa; }
		const float Max = FMath::Max(Cu->GradosMax(), 1.f), Ang = FMath::Clamp(Cu->Grados(), 0.f, Max);
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
		const FLinearColor Gris(0.30f, 0.34f, 0.40f), Naranja(FColor::FromHex(TEXT("f0a040")));
		Arco(0.f, 180.f, R, FLinearColor(0.14f, 0.17f, 0.22f), 2.f, Capa);            // transportador entero
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

TSharedRef<SWidget> SCorpusInterfaz::Boton(const FString& Texto, TFunction<void()> Accion, bool bAcento) const
{
	return SNew(SButton)
		.ButtonColorAndOpacity(bAcento ? C_ACENTO : FLinearColor(0.12f, 0.15f, 0.20f))
		.ContentPadding(FMargin(10.f, 5.f))
		.OnClicked_Lambda([Accion]() { Accion(); return FReply::Handled(); })
		[ Txt(Texto, 10, C_TINTA, bAcento) ];
}

void SCorpusInterfaz::Construct(const FArguments& Args)
{
	Jugador = Args._Jugador;
	SetVisibility(EVisibility::SelfHitTestInvisible);

	ChildSlot
	[
		SNew(SOverlay)
		// ── Debajo de los paneles: marcas de los relieves óseos sobre el modelo ──
		+ SOverlay::Slot().HAlign(HAlign_Fill).VAlign(VAlign_Fill)[ SAssignNew(Marcas, SCorpusMarcas) ]
		// ── Panel izquierdo: cuerpo, idioma y capas ──
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Fill).Padding(18.f)
		[
			SNew(SBox).WidthOverride(340.f)
			.Visibility_Lambda([this]() { return bPanelPlegado ? EVisibility::Collapsed : EVisibility::Visible; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(16.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(TEXT("CORPUS"), 22, C_TINTA, true) ]
						// plegar el panel: el modelo ocupa toda la pantalla
						+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[ Boton(TEXT("«"), [this]() { bPanelPlegado = true; }) ]
					]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, 2, 0, 10)[ SAssignNew(CajaBarra, SVerticalBox) ]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)[ SAssignNew(CajaHerr, SVerticalBox) ]
					+ SVerticalBox::Slot().FillHeight(1.f)
					[
						SNew(SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaCapas, SVerticalBox) ]
					]
				]
			]
		]
		// ── Panel izquierdo plegado: solo un botón para volver a abrirlo ──
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(18.f)
		[
			SNew(SBox)
			.Visibility_Lambda([this]() { return bPanelPlegado ? EVisibility::Visible : EVisibility::Collapsed; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(8.f)[ SAssignNew(CajaMini, SVerticalBox) ]
			]
		]
		// ── Arriba: buscador ──
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Top).Padding(18.f)
		[
			SNew(SBox).WidthOverride(460.f)
			[
				SNew(SBorder).BorderImage(Panel()).Padding(10.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SAssignNew(Buscador, SEditableTextBox).Font(Letra(12))
						.OnTextChanged(this, &SCorpusInterfaz::RehacerResultados)
					]
					+ SVerticalBox::Slot().AutoHeight().MaxHeight(420.f)
					[
						SNew(SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaResultados, SVerticalBox) ]
					]
				]
			]
		]
		// ── Abajo: movimiento (rango articular) ──
		// (a la derecha: en el centro tapaba las piernas y los pies, que es lo que hay que ver en la marcha)
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Bottom).Padding(18.f)
		[
			SNew(SBox).WidthOverride(520.f)
			.Visibility_Lambda([this]() { const ACorpusCuerpo* C = Cuerpo(); return !bVerEst && C && C->MovimientoDisponible() && (bVerMov || C->HayPostura()) ? EVisibility::Visible : EVisibility::Collapsed; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(14.f)[ SAssignNew(CajaMov, SVerticalBox) ]
			]
		]
		// ── Derecha: ficha de la estructura seleccionada ──
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(18.f)
		[
			SNew(SBox).WidthOverride(400.f).MaxDesiredHeight(860.f)
			.Visibility_Lambda([this]() { const ACorpusCuerpo* C = Cuerpo(); return !bVerEst && C && !C->Seleccionada().IsEmpty() ? EVisibility::Visible : EVisibility::Collapsed; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(18.f)
				[
					SNew(SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaFicha, SVerticalBox) ]
				]
			]
		]
		// ── Derecha, a toda la altura: panel de estudio (lecciones, recorridos, kinesiología, casos, patologías, glosario) ──
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Fill).Padding(18.f)
		[
			SNew(SBox).WidthOverride(500.f)
			.Visibility_Lambda([this]() { return bVerEst ? EVisibility::Visible : EVisibility::Collapsed; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(16.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[ SAssignNew(CajaEstCab, SVerticalBox) ]
					+ SVerticalBox::Slot().FillHeight(1.f).Padding(0, 8, 0, 0)
					[
						SAssignNew(RolloEst, SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaEst, SVerticalBox) ]
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
	CajaBarra->AddSlot().AutoHeight()[ Txt(D->T(TEXT("Atlas anatómico 3D libre")), 10, C_GRIS) ];

	// Cuerpo: hombre, mujer o Visible Human
	TSharedRef<SWrapBox> FilaCuerpo = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6));
	const TPair<const TCHAR*, ECorpusCuerpo> Cuerpos[] = { {TEXT("Hombre"), ECorpusCuerpo::Hombre}, {TEXT("Mujer"), ECorpusCuerpo::Mujer}, {TEXT("Visible Human"), ECorpusCuerpo::VisibleHuman} };
	for (const auto& Par : Cuerpos)
	{
		const ECorpusCuerpo Cual = Par.Value;
		FilaCuerpo->AddSlot()[ Boton(D->T(Par.Key), [WC, Cual]() { if (WC.IsValid()) { WC->PonerCuerpo(Cual); } }, C->Cuerpo() == Cual) ];
	}
	CajaBarra->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ FilaCuerpo ];

	// Idioma
	TSharedRef<SWrapBox> FilaIdioma = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6));
	for (const TCHAR* L : { TEXT("es"), TEXT("en"), TEXT("pt"), TEXT("fr"), TEXT("de") })
	{
		const FString Cod(L);
		FilaIdioma->AddSlot()[ Boton(Cod.ToUpper(), [WD, Cod]() { if (WD.IsValid()) { WD->PonerIdioma(Cod); } }, D->Idioma() == Cod) ];
	}
	CajaBarra->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ FilaIdioma ];

	// Vistas fijas y mostrar todo
	TSharedRef<SWrapBox> FilaVistas = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6));
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
			if (WC.IsValid() && !bVerMov) { WC->QuitarPostura(); }
			MovPintado = FIntVector(-2, -2, -2); RehacerMovimiento();
		}, bVerMov) ];
	}
	FilaVistas->AddSlot()[ Boton(D->TE(TEXT("Estudiar")), [this]() { AbrirEstudio(!bVerEst); }, bVerEst) ];
	CajaBarra->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ FilaVistas ];

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
	CajaHerr->AddSlot().AutoHeight().Padding(0, 4, 0, 4)[ Txt(Mayus(D->T(TEXT("Disección"))), 9, C_GRIS, true) ];
	CajaHerr->AddSlot().AutoHeight()
	[
		SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6))
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Fantasma")), [WC]() { if (WC.IsValid()) { WC->Fantasma(!WC->EnFantasma()); } }, C->EnFantasma()) ]
	];

	// ── Plano de corte: sagital, coronal o axial (otra vez sobre el activo lo apaga), posición e invertir ──
	CajaHerr->AddSlot().AutoHeight().Padding(0, 8, 0, 4)[ Txt(Mayus(D->T(TEXT("Plano de corte"))), 9, C_GRIS, true) ];
	TSharedRef<SWrapBox> FilaCorte = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6));
	const TCHAR* Ejes[] = { TEXT("Sagital"), TEXT("Coronal"), TEXT("Axial") };
	const int32 Eje = C->EjeCorte();
	for (int32 i = 0; i < 3; ++i)
	{
		FilaCorte->AddSlot()[ Boton(D->T(Ejes[i]), [WC, i]() { if (WC.IsValid()) { if (WC->EjeCorte() == i) { WC->QuitarCorte(); } else { WC->PonerCorte(i, 0.5f); } } }, Eje == i) ];
	}
	if (Eje >= 0)
	{
		FilaCorte->AddSlot()[ Boton(D->T(TEXT("Invertir")), [WC]() { if (WC.IsValid()) { WC->InvertirCorte(); } }, C->CorteInvertido()) ];
		FilaCorte->AddSlot()[ Boton(D->T(TEXT("Quitar corte")), [WC]() { if (WC.IsValid()) { WC->QuitarCorte(); } }) ];
	}
	CajaHerr->AddSlot().AutoHeight()[ FilaCorte ];
	if (Eje >= 0)
	{
		CajaHerr->AddSlot().AutoHeight().Padding(0, 6, 0, 0)
		[
			SNew(SSlider).MinValue(0.f).MaxValue(1.f)
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
	if (FIntVector(C->PatronMarcha() >= 0 ? 1000 + C->PatronMarcha() : C->Rango(), C->Movimiento(), (C->LadoIzquierdo() ? 1 : 0) + (C->Reproduciendo() ? 2 : 0) + (C->MarchaEnCurso() ? 4 : 0) + (C->EsMarchaLenta() ? 8 : 0)) != MovPintado) { RehacerMovimiento(); }
}

void SCorpusInterfaz::RehacerMovimiento()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaMov.IsValid()) { return; }
	MovPintado = FIntVector(C->PatronMarcha() >= 0 ? 1000 + C->PatronMarcha() : C->Rango(), C->Movimiento(), (C->LadoIzquierdo() ? 1 : 0) + (C->Reproduciendo() ? 2 : 0) + (C->MarchaEnCurso() ? 4 : 0) + (C->EsMarchaLenta() ? 8 : 0));
	CajaMov->ClearChildren();
	if (!C->MovimientoDisponible()) { return; }
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	const TArray<FCorpusRango>& Rs = D->Rangos();
	const int32 Ri = C->Rango(), Mi = C->Movimiento();
	const bool bIzq = C->LadoIzquierdo();

	// modo: rango articular o marcha
	const bool bMarcha = C->PatronMarcha() >= 0;
	{
		TSharedRef<SHorizontalBox> Modos = SNew(SHorizontalBox);
		Modos->AddSlot().AutoWidth().Padding(0, 0, 5, 0)[ Boton(D->T(TEXT("Rango articular")), [WC]() { if (WC.IsValid()) { WC->PonerMarcha(-1, 0.f); } }, !bMarcha) ];
		if (D->PatronesMarcha().Num() > 0)
		{
			Modos->AddSlot().AutoWidth()[ Boton(D->T(TEXT("Marcha")), [WC]() { if (WC.IsValid()) { WC->QuitarPostura(); WC->PonerMarcha(0, 0.f); WC->ReproducirMarcha(true); } }, bMarcha) ];
		}
		CajaMov->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Modos ];
	}
	if (bMarcha)
	{
		const TArray<FCorpusPatronMarcha>& Ps = D->PatronesMarcha();
		const int32 Pi = C->PatronMarcha();
		TSharedRef<SWrapBox> FilaP = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
		for (int32 i = 0; i < Ps.Num(); ++i)
		{
			FilaP->AddSlot()[ Boton(D->T(Ps[i].Nombre), [WC, i]() { if (WC.IsValid()) { WC->PonerMarcha(i, WC->CicloDeMarcha()); } }, i == Pi) ];
		}
		CajaMov->AddSlot().AutoHeight()[ FilaP ];
		TWeakObjectPtr<UCorpusDatos> WD(D);
		// fase del ciclo (del miembro derecho) y qué ocurre en ella
		CajaMov->AddSlot().AutoHeight().Padding(0, 10, 0, 0)
		[
			SNew(STextBlock).Font(Letra(13, true)).ColorAndOpacity(FSlateColor(C_ACENTO))
			.Text_Lambda([WC, WD]() { if (!WC.IsValid() || !WD.IsValid()) { return FText(); } const int32 F = WC->FaseDeMarcha(); if (!WD->FasesMarcha().IsValidIndex(F)) { return FText(); }
				return FText::FromString(FString::Printf(TEXT("%s · %d %%"), *WD->T(WD->FasesMarcha()[F].Nombre), FMath::RoundToInt(WC->CicloDeMarcha()))); })
		];
		CajaMov->AddSlot().AutoHeight().Padding(0, 2, 0, 0)
		[
			SNew(STextBlock).Font(Letra(10)).ColorAndOpacity(FSlateColor(C_TINTA)).AutoWrapText(true)
			.Text_Lambda([WC, WD]() { if (!WC.IsValid() || !WD.IsValid()) { return FText(); } const int32 F = WC->FaseDeMarcha(); return WD->FasesMarcha().IsValidIndex(F) ? FText::FromString(WD->T(WD->FasesMarcha()[F].Texto)) : FText(); })
		];
		if (Ps.IsValidIndex(Pi) && !Ps[Pi].Texto.IsEmpty()) { CajaMov->AddSlot().AutoHeight().Padding(0, 6, 0, 0)[ Txt(D->T(Ps[Pi].Texto), 9, C_GRIS) ]; }
		TSharedRef<SHorizontalBox> FilaC = SNew(SHorizontalBox);
		FilaC->AddSlot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider).MinValue(0.f).MaxValue(99.9f)
			.Value_Lambda([WC]() { return WC.IsValid() ? WC->CicloDeMarcha() : 0.f; })
			.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid()) { WC->ReproducirMarcha(false); WC->PonerMarcha(WC->PatronMarcha(), V); } })
		];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(10, 0, 0, 0)[ Boton(D->T(C->MarchaEnCurso() ? TEXT("Pausa") : TEXT("Reproducir")), [WC]() { if (WC.IsValid()) { WC->ReproducirMarcha(!WC->MarchaEnCurso()); } }, true) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(5, 0, 0, 0)[ Boton(D->T(TEXT("Cámara lenta")), [WC]() { if (WC.IsValid()) { WC->MarchaLenta(!WC->EsMarchaLenta()); } }, C->EsMarchaLenta()) ];
		FilaC->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(5, 0, 0, 0)[ Boton(D->T(TEXT("Reposo")), [WC]() { if (WC.IsValid()) { WC->PonerMarcha(-1, 0.f); } }) ];
		CajaMov->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ FilaC ];
		// leyenda: cada grupo muscular con su intensidad en este instante (barra) y el tipo de contracción (miembro derecho)
		{
			TSharedRef<SVerticalBox> Ley = SNew(SVerticalBox);
			for (int32 g = 0; g < D->GruposMarcha().Num(); ++g)
			{
				const FCorpusGrupoMarcha& G = D->GruposMarcha()[g];
				Ley->AddSlot().AutoHeight().Padding(0, 1)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
					[
						SNew(STextBlock).Font(Letra(9)).Text(FText::FromString(D->T(G.Nombre))).ToolTipText(FText::FromString(D->T(G.Texto)))
						.ColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() && WC->NivelDeGrupo(g) > 0.05f ? C_TINTA : C_GRIS); })
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(6, 0)
					[
						SNew(SBox).WidthOverride(70.f).HeightOverride(7.f)
						[
							SNew(SProgressBar).FillImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderPadding(FVector2D::ZeroVector)   // relleno blanco: el color es el de la actividad
							.Percent_Lambda([WC, g]() { return TOptional<float>(WC.IsValid() ? FMath::Clamp(WC->NivelDeGrupo(g) / 0.6f, 0.f, 1.f) : 0.f); })
							.FillColorAndOpacity_Lambda([WC, g]() { return FSlateColor(WC.IsValid() ? ACorpusCuerpo::ColorDeNivel(WC->NivelDeGrupo(g)) : FLinearColor::Gray); })
						]
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
					[
						SNew(SBox).WidthOverride(78.f)
						[
							SNew(STextBlock).Font(Letra(9)).ColorAndOpacity(FSlateColor(C_ACENTO))
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
			CajaMov->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ Ley ];
		}
		CajaMov->AddSlot().AutoHeight().Padding(0, 6, 0, 0)[ Txt(D->T(TEXT("Actividad muscular: amarillo (poca) → magenta (mucha). Datos de laboratorio: Fukuchi 2018, Schreiber 2019, Lencioni 2019.")), 8, C_GRIS) ];
		return;
	}
	// goniómetro: el ángulo actual en grande, el máximo del movimiento y el transportador
	if (Rs.IsValidIndex(Ri) && Rs[Ri].Movs.IsValidIndex(Mi))
	{
		TSharedRef<SCorpusGonio> Gonio = SNew(SCorpusGonio);
		Gonio->Cuerpo = WC;
		FString Titulo = D->T(Rs[Ri].Nombre) + TEXT(" · ") + D->T(Rs[Ri].Movs[Mi].Nombre);
		if (Rs[Ri].bLados) { Titulo += TEXT(" · ") + D->T(bIzq ? TEXT("Izquierdo") : TEXT("Derecho")); }
		CajaMov->AddSlot().AutoHeight().Padding(0, 0, 0, 10)
		[
			SNew(SBorder).BorderImage(Panel2()).Padding(FMargin(12, 8))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[ Gonio ]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center).Padding(16, 0, 0, 0)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[ Txt(Mayus(Titulo), 9, C_GRIS, true) ]
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(STextBlock).Font(Letra(44, true)).ColorAndOpacity(FSlateColor(C_TINTA))
						.Text_Lambda([WC]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("%d°"), FMath::RoundToInt(WC->Grados()))) : FText(); })
					]
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(STextBlock).Font(Letra(13, true)).ColorAndOpacity(FSlateColor(FLinearColor(FColor::FromHex(TEXT("f0a040")))))
						.Text_Lambda([WC]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("máx. %d°  ·  %d %%"), FMath::RoundToInt(WC->GradosMax()), WC->GradosMax() > 0.f ? FMath::RoundToInt(100.f * WC->Grados() / WC->GradosMax()) : 0)) : FText(); })
					]
				]
			]
		];
	}
	TSharedRef<SWrapBox> FilaR = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
	for (int32 i = 0; i < Rs.Num(); ++i)
	{
		FilaR->AddSlot()[ Boton(D->T(Rs[i].Nombre), [WC, i, bIzq]() { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(i, 0, bIzq, 0.f); } }, i == Ri) ];
	}
	CajaMov->AddSlot().AutoHeight().Padding(0, 6, 0, 0)[ FilaR ];
	if (!Rs.IsValidIndex(Ri)) { return; }

	const FCorpusRango& R = Rs[Ri];
	TSharedRef<SWrapBox> FilaM = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
	for (int32 m = 0; m < R.Movs.Num(); ++m)
	{
		FilaM->AddSlot()[ Boton(D->T(R.Movs[m].Nombre), [WC, Ri, m, bIzq]() { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(Ri, m, bIzq, 0.f); } }, m == Mi) ];
	}
	CajaMov->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ FilaM ];

	// lado: en las articulaciones pares, derecho o izquierdo; en el tronco y el cuello, el sentido de la inclinación o el giro
	TSharedRef<SHorizontalBox> Fila = SNew(SHorizontalBox);
	if (R.Movs.IsValidIndex(Mi) && R.Movs[Mi].Izquierdo.Num() > 0)
	{
		const TCHAR* LD = R.bLados ? TEXT("Derecho") : TEXT("Hacia la derecha");
		const TCHAR* LI = R.bLados ? TEXT("Izquierdo") : TEXT("Hacia la izquierda");
		Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 5, 0)[ Boton(D->T(LD), [WC, Ri, Mi]() { if (WC.IsValid()) { WC->PonerRango(Ri, Mi, false, WC->Grados()); } }, !bIzq) ];
		Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 10, 0)[ Boton(D->T(LI), [WC, Ri, Mi]() { if (WC.IsValid()) { WC->PonerRango(Ri, Mi, true, WC->Grados()); } }, bIzq) ];
	}
	Fila->AddSlot().FillWidth(1.f).VAlign(VAlign_Center)
	[
		SNew(SSlider).MinValue(0.f).MaxValue(1.f)
		.Value_Lambda([WC]() { return WC.IsValid() && WC->GradosMax() > 0.f ? WC->Grados() / WC->GradosMax() : 0.f; })
		.OnValueChanged_Lambda([WC](float V) { if (WC.IsValid()) { WC->Reproducir(false); WC->PonerRango(WC->Rango(), WC->Movimiento(), WC->LadoIzquierdo(), V * WC->GradosMax()); } })
	];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(10, 0)
	[
		SNew(SBox).WidthOverride(84.f)
		[
			SNew(STextBlock).Font(Letra(12, true)).ColorAndOpacity(FSlateColor(C_TINTA))
			.Text_Lambda([WC]() { return WC.IsValid() ? FText::FromString(FString::Printf(TEXT("%d° / %d°"), FMath::RoundToInt(WC->Grados()), FMath::RoundToInt(WC->GradosMax()))) : FText(); })
		]
	];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center)[ Boton(D->T(C->Reproduciendo() ? TEXT("Pausa") : TEXT("Reproducir")), [WC]() { if (WC.IsValid()) { WC->Reproducir(!WC->Reproduciendo()); } }, true) ];
	Fila->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(5, 0, 0, 0)[ Boton(D->T(TEXT("Reposo")), [WC]() { if (WC.IsValid()) { WC->QuitarPostura(); } }) ];
	CajaMov->AddSlot().AutoHeight().Padding(0, 12, 0, 0)[ Fila ];
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
			CajaCapas->AddSlot().AutoHeight().Padding(0, 12, 0, 4)[ Txt(Mayus(D->T(Grupo)), 9, C_GRIS, true) ];
		}
		const FString Clave = Capa.Clave;
		CajaCapas->AddSlot().AutoHeight().Padding(0, 2)
		[
			SNew(SBorder).BorderImage(Panel2()).Padding(FMargin(8, 5))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
				[
					SNew(SCheckBox)
					.IsChecked_Lambda([WC, Clave]() { return WC.IsValid() && WC->CapaVisible(Clave) ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
					.OnCheckStateChanged_Lambda([WC, Clave](ECheckBoxState E) { if (WC.IsValid()) { WC->MostrarCapa(Clave, E == ECheckBoxState::Checked); } })
				]
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(6, 0)
				[
					SNew(SBox).WidthOverride(12.f).HeightOverride(12.f)[ SNew(SImage).Image(Punto()).ColorAndOpacity(Capa.Color) ]
				]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(D->T(Capa.Nombre), 10, C_TINTA) ]
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(6, 0, 0, 0)
				[
					SNew(SBox).WidthOverride(64.f)
					[
						SNew(SSlider).MinValue(0.05f).MaxValue(1.f)
						.Value_Lambda([WC, Clave]() { return WC.IsValid() ? WC->OpacidadDeCapa(Clave) : 1.f; })
						.OnValueChanged_Lambda([WC, Clave](float V) { if (WC.IsValid()) { WC->OpacidadCapa(Clave, V); } })
					]
				]
			]
		];
		// pelar capas: los músculos por profundidad (extras.json → dep), como en la web; encendido = se ve
		if (Clave == TEXT("muscular"))
		{
			TSharedRef<SWrapBox> Pelar = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
			const TPair<const TCHAR*, const TCHAR*> Profs[] = { {TEXT("s"), TEXT("Superficiales")}, {TEXT("i"), TEXT("Intermedios")}, {TEXT("p"), TEXT("Profundos")} };
			for (const auto& Par : Profs)
			{
				const FString Pf(Par.Key);
				Pelar->AddSlot()
				[ Boton(D->T(Par.Value), [WC, Pf]() { if (WC.IsValid()) { WC->PelarProfundidad(Pf, !WC->ProfundidadOculta(Pf)); } }, !C->ProfundidadOculta(Pf)) ];
			}
			CajaCapas->AddSlot().AutoHeight().Padding(8, 2, 0, 6)[ Pelar ];
		}
	}
}

bool SCorpusInterfaz::Qa(const FString& Verbo, const FString& Resto)
{
	// panel <0|1>: pliega (0) o abre (1) el panel izquierdo
	if (Verbo == TEXT("panel")) { bPanelPlegado = Resto == TEXT("0"); return true; }
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

	CajaFicha->AddSlot().AutoHeight()[ Txt(D->NombrePieza(Id), 17, C_TINTA, true) ];
	if (!P->La.IsEmpty()) { CajaFicha->AddSlot().AutoHeight().Padding(0, 2, 0, 0)[ Txt(P->La, 11, C_GRIS) ]; }
	FString Sub = D->NombreCapa(P->Sistema);
	if (!P->Lado.IsEmpty()) { Sub += TEXT(" · ") + D->NombreLado(P->Lado); }
	if (!P->Rol.IsEmpty()) { Sub += TEXT(" · ") + D->T(UCorpusDatos::EsOrigen(*P) ? TEXT("Origen") : TEXT("Inserción")); }   // áreas de la capa «insercion»
	CajaFicha->AddSlot().AutoHeight().Padding(0, 6, 0, 10)[ Txt(Sub, 10, C_ACENTO, true) ];

	TSharedRef<SWrapBox> Acciones = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6))
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Encuadrar")), [WJ]() { if (WJ.IsValid()) { WJ->EncuadrarSeleccion(); } }, true) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Aislar")), [WC, Id]() { if (WC.IsValid()) { WC->Aislar(Id); } }) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Ocultar")), [WC, Id]() { if (WC.IsValid()) { WC->Ocultar(Id); } }) ];
	// mapa de origen (rojo) e inserción (azul) del hueso o del músculo seleccionado
	const bool bMapa = C->EnMapaInserciones();
	if (bMapa || C->TieneInserciones(Id))
	{
		Acciones->AddSlot()[ Boton(D->T(TEXT("Orígenes e inserciones")), [WC]() { if (WC.IsValid()) { WC->MapaInserciones(!WC->EnMapaInserciones()); } }, bMapa) ];
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
			CajaFicha->AddSlot().AutoHeight().Padding(0, 10, 0, 2)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 6, 0)[ SNew(SBox).WidthOverride(12.f).HeightOverride(12.f)[ SNew(SImage).Image(Punto()).ColorAndOpacity(Colores[k]) ] ]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(FString::Printf(TEXT("%s (%d)"), *Mayus(D->T(Titulos[k])), Nombres[k].Num()), 9, C_GRIS, true) ]
			];
			CajaFicha->AddSlot().AutoHeight()[ Txt(FString::Join(Nombres[k], TEXT(" · ")), 10, C_TINTA) ];
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
			CajaFicha->AddSlot().AutoHeight().Padding(0, 12, 0, 4)[ Txt(FString::Printf(TEXT("%s (%d)"), *Mayus(D->TE(TEXT("Estudiar"))), Es.Num()), 9, C_GRIS, true) ];
			for (int32 k = 0; k < Es.Num() && k < MAXIMO; ++k)
			{
				const FIntVector4 En = Es[k];
				const FCorpusModuloEstudio& M = E.Modulos[En.X];
				const FCorpusItemEstudio& It = M.Grupos[En.Y].Items[En.Z];
				EnlacesFicha.Add(En);
				CajaFicha->AddSlot().AutoHeight().Padding(0, 3, 0, 0)
				[
					SNew(SButton).ButtonColorAndOpacity(FLinearColor(0.07f, 0.11f, 0.17f)).ContentPadding(FMargin(10, 5)).HAlign(HAlign_Fill)
					.OnClicked_Lambda([this, En]() { AbrirEnlace(En); return FReply::Handled(); })
					[
						SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight()[ Txt(It.T, 11, C_TINTA) ]
						+ SVerticalBox::Slot().AutoHeight()[ Txt(M.N + (M.Grupos.Num() > 1 ? TEXT(" · ") + M.Grupos[En.Y].N : FString()), 9, C_ACENTO) ]
					]
				];
			}
			if (Es.Num() > MAXIMO) { CajaFicha->AddSlot().AutoHeight().Padding(0, 4, 0, 0)[ Txt(FString::Printf(TEXT("+ %d"), Es.Num() - MAXIMO), 9, C_GRIS) ]; }
		}
	}

	// relieves óseos (data/extras.json → lm): uno por botón; se marcan sobre el hueso con su nombre
	const TArray<FCorpusRelieve>& Rs = D->Relieves(Id);
	if (Rs.Num() > 0)
	{
		CajaFicha->AddSlot().AutoHeight().Padding(0, 12, 0, 4)[ Txt(FString::Printf(TEXT("%s (%d)"), *Mayus(D->T(TEXT("Accidentes óseos"))), Rs.Num()), 9, C_GRIS, true) ];
		TArray<int32> Todos; for (int32 i = 0; i < Rs.Num(); ++i) { Todos.Add(i); }
		CajaFicha->AddSlot().AutoHeight()
		[
			SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6))
			+ SWrapBox::Slot()[ Boton(D->T(TEXT("Mostrar todos")), [this, Todos]() { VerRelieves(Todos, false); }, RelVistos.Num() == Rs.Num()) ]
			+ SWrapBox::Slot()[ Boton(D->T(TEXT("Ocultar marcas")), [this]() { VerRelieves(TArray<int32>(), false); }) ]
		];
		TSharedRef<SWrapBox> Lista = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
		for (int32 i = 0; i < Rs.Num(); ++i)
		{
			Lista->AddSlot()[ Boton(D->NombreRelieve(Rs[i]), [this, i]() { VerRelieves(TArray<int32>({ i }), true); }, RelVistos.Num() < Rs.Num() && RelVistos.Contains(i)) ];
		}
		CajaFicha->AddSlot().AutoHeight().Padding(0, 6, 0, 0)[ Lista ];
	}

	for (const TPair<FString, FString>& Campo : D->Ficha(Id))
	{
		CajaFicha->AddSlot().AutoHeight().Padding(0, 12, 0, 2)[ Txt(Mayus(Campo.Key), 9, C_GRIS, true) ];
		CajaFicha->AddSlot().AutoHeight()[ Txt(Campo.Value, 11, C_TINTA) ];
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
		FString Etiqueta = D->NombrePieza(Id);
		if (!P->Lado.IsEmpty()) { Etiqueta += TEXT(" · ") + D->NombreLado(P->Lado); }
		const FString Sistema = P->Sistema;
		CajaResultados->AddSlot().AutoHeight().Padding(0, 3, 0, 0)
		[
			SNew(SButton).ButtonColorAndOpacity(FLinearColor(0.10f, 0.13f, 0.17f)).ContentPadding(FMargin(10, 5))
			.OnClicked_Lambda([WC, WJ, Id, Sistema]()
			{
				if (WC.IsValid())
				{
					// como en la web: buscar enciende la capa de la estructura, la selecciona y la encuadra
					WC->MostrarCapa(Sistema, true);
					WC->Seleccionar(Id);
					if (WJ.IsValid()) { WJ->EncuadrarSeleccion(); }
				}
				return FReply::Handled();
			})
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()[ Txt(Etiqueta, 11, C_TINTA) ]
				+ SVerticalBox::Slot().AutoHeight()[ Txt(D->NombreCapa(Sistema), 9, C_GRIS) ]
			]
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
		CajaEst->AddSlot().AutoHeight()[ Txt(TEXT("Faltan los datos de estudio: node tools/unreal/estudio.js"), 11, C_GRIS) ];
		return;
	}
	EstMod = FMath::Clamp(EstMod, 0, E.Modulos.Num() - 1);
	const FCorpusModuloEstudio& M = E.Modulos[EstMod];
	TWeakObjectPtr<ACorpusCuerpo> WC(C);

	// fila ancha con el texto a la izquierda (entradas de las listas)
	const auto Fila = [](const FString& Titulo, const FString& Sub, TFunction<void()> Accion, const FLinearColor& Fondo = FLinearColor(0.10f, 0.13f, 0.17f)) -> TSharedRef<SWidget>
	{
		TSharedRef<SVerticalBox> V = SNew(SVerticalBox) + SVerticalBox::Slot().AutoHeight()[ Txt(Titulo, 11, C_TINTA) ];
		if (!Sub.IsEmpty()) { V->AddSlot().AutoHeight()[ Txt(Sub, 9, C_GRIS) ]; }
		return SNew(SButton).ButtonColorAndOpacity(Fondo).ContentPadding(FMargin(10, 6)).HAlign(HAlign_Fill)
			.OnClicked_Lambda([Accion]() { Accion(); return FReply::Handled(); })[ V ];
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
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)[ Txt(Mayus(D->TE(TEXT("Estudiar"))), 13, C_TINTA, true) ]
		+ SHorizontalBox::Slot().AutoWidth()[ Boton(D->TE(TEXT("Cerrar")), [this]() { AbrirEstudio(false); }) ]
	];
	TSharedRef<SWrapBox> Mods = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5));
	for (int32 i = 0; i < E.Modulos.Num(); ++i)
	{
		Mods->AddSlot()[ Boton(E.Modulos[i].N, [this, i, Ir]() { EstMod = i; EstFiltro.Reset(); Ir(-1, -1); }, i == EstMod) ];
	}
	CajaEstCab->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ Mods ];

	const FCorpusItemEstudio* It = ItemEstudio();
	if (!It)
	{
		// ── listas: buscador, grupos y entradas ──
		CajaEstCab->AddSlot().AutoHeight().Padding(0, 8, 0, 0)
		[
			SNew(SEditableTextBox).Font(Letra(11)).HintText(FText::FromString(D->TE(TEXT("Buscar")))).Text(FText::FromString(EstFiltro))
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
					CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Fila(X.T, M.Grupos[g].N, [Ir, g, i]() { Ir(g, i); }) ];
					++N;
				}
			}
			if (N == 0) { CajaEst->AddSlot().AutoHeight().Padding(0, 6)[ Txt(D->TE(TEXT("Nada")), 11, C_GRIS) ]; }
			return;
		}
		const bool bUnGrupo = M.Grupos.Num() == 1;
		if (!M.Grupos.IsValidIndex(EstGrupo) && !bUnGrupo)
		{
			for (int32 g = 0; g < M.Grupos.Num(); ++g)
			{
				CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)
				[ Fila(M.Grupos[g].N, FString::Printf(TEXT("%d %s"), M.Grupos[g].Items.Num(), *D->TE(TEXT("Entradas"))), [Ir, g]() { Ir(g, -1); }, FLinearColor(0.07f, 0.11f, 0.17f)) ];
			}
			if (M.Id == TEXT("patologias") && !E.Aviso.IsEmpty()) { CajaEst->AddSlot().AutoHeight().Padding(0, 12, 0, 0)[ Txt(E.Aviso, 9, C_GRIS) ]; }
			return;
		}
		const int32 g = bUnGrupo ? 0 : EstGrupo;
		if (!bUnGrupo)
		{
			CajaEst->AddSlot().AutoHeight()[ SNew(SHorizontalBox) + SHorizontalBox::Slot().AutoWidth()[ Boton(D->TE(TEXT("Volver")), [Ir]() { Ir(-1, -1); }) ] ];
			CajaEst->AddSlot().AutoHeight().Padding(0, 8, 0, 4)[ Txt(M.Grupos[g].N, 13, C_ACENTO, true) ];
		}
		for (int32 i = 0; i < M.Grupos[g].Items.Num(); ++i)
		{
			const FCorpusItemEstudio& X = M.Grupos[g].Items[i];
			CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Fila(X.T, X.Sub, [Ir, g, i]() { Ir(g, i); }) ];
		}
		return;
	}

	// ── ficha de una entrada ──
	const int32 gAct = EstGrupo;
	const bool bUnSolo = M.Grupos.Num() == 1;
	CajaEst->AddSlot().AutoHeight()
	[
		SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(5, 5))
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Volver")), [this, Ir, gAct, bUnSolo]() { Ir((EstFiltro.Len() >= 2 || bUnSolo) ? -1 : gAct, -1); }) ]
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Ver")), [this]() { EnsenarEstudio(); }, true) ]
		+ SWrapBox::Slot()[ Boton(D->TE(TEXT("Todo")), [WC]() { if (WC.IsValid()) { WC->RestaurarEstado(); WC->MostrarTodo(); } }) ]
	];
	CajaEst->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ Txt(It->T, 15, C_TINTA, true) ];
	FString Sub = M.Grupos[EstGrupo].N;
	if (!It->Sub.IsEmpty()) { Sub += TEXT(" · ") + It->Sub; }
	CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Txt(Sub, 10, C_ACENTO, true) ];

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
			const float Alto = FMath::Min(456.f * Prop, 520.f);
			CajaEst->AddSlot().AutoHeight().Padding(0, 10, 0, 0).HAlign(HAlign_Left)
			[
				SNew(SBox).WidthOverride(Alto / FMath::Max(Prop, 0.01f)).HeightOverride(Alto)[ SNew(SImage).Image(EstPincel.Get()) ]
			];
			CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Txt(D->TE(TEXT("Imagen")) + TEXT(": ") + It->Cred, 8, C_GRIS) ];
		}
	}

	// pasos (lecciones y recorridos)
	if (It->Pasos.Num() > 0)
	{
		EstPaso = FMath::Clamp(EstPaso, 0, It->Pasos.Num() - 1);
		const FCorpusPasoEstudio& P = It->Pasos[EstPaso];
		const int32 NP = It->Pasos.Num();
		TSharedRef<SVerticalBox> Caja = SNew(SVerticalBox);
		Caja->AddSlot().AutoHeight()[ Txt(FString::Printf(TEXT("%s %d / %d"), *Mayus(D->TE(TEXT("Paso"))), EstPaso + 1, NP), 9, C_GRIS, true) ];
		Caja->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Txt(P.T, 13, C_ACENTO, true) ];
		Caja->AddSlot().AutoHeight().Padding(0, 5, 0, 0)[ Txt(P.X, 11, C_TINTA) ];
		const auto IrPaso = [this](int32 Paso) { EstPaso = Paso; RehacerEstudio(); EnsenarEstudio(); };
		TSharedRef<SHorizontalBox> Nav = SNew(SHorizontalBox);
		if (EstPaso > 0) { Nav->AddSlot().AutoWidth().Padding(0, 0, 6, 0)[ Boton(D->TE(TEXT("Anterior")), [IrPaso, this]() { IrPaso(EstPaso - 1); }) ]; }
		if (EstPaso < NP - 1) { Nav->AddSlot().AutoWidth()[ Boton(D->TE(TEXT("Siguiente")), [IrPaso, this]() { IrPaso(EstPaso + 1); }, true) ]; }
		Caja->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ Nav ];
		CajaEst->AddSlot().AutoHeight().Padding(0, 12, 0, 0)[ SNew(SBorder).BorderImage(Panel2()).Padding(12.f)[ Caja ] ];
	}

	for (const TPair<FString, FString>& S : It->Secs)
	{
		CajaEst->AddSlot().AutoHeight().Padding(0, 12, 0, 2)[ Txt(Mayus(S.Key), 9, C_GRIS, true) ];
		CajaEst->AddSlot().AutoHeight()[ Txt(S.Value, 11, C_TINTA) ];
	}

	// preguntas
	if (It->Q.Num() > 0)
	{
		CajaEst->AddSlot().AutoHeight().Padding(0, 16, 0, 2)[ Txt(Mayus(D->TE(TEXT("Preguntas"))), 9, C_GRIS, true) ];
		int32 Aciertos = 0, Hechas = 0;
		for (int32 q = 0; q < It->Q.Num(); ++q)
		{
			const FCorpusPregunta& Q = It->Q[q];
			const int32* Elegida = EstResp.Find(q);
			if (Elegida) { ++Hechas; if (*Elegida == Q.A) { ++Aciertos; } }
			CajaEst->AddSlot().AutoHeight().Padding(0, 8, 0, 2)[ Txt(It->Q.Num() > 1 ? FString::Printf(TEXT("%d. %s"), q + 1, *Q.P) : Q.P, 11, C_TINTA, true) ];
			for (int32 o = 0; o < Q.O.Num(); ++o)
			{
				FLinearColor Fondo(0.10f, 0.13f, 0.17f);
				if (Elegida) { if (o == Q.A) { Fondo = FLinearColor(0.05f, 0.38f, 0.16f); } else if (o == *Elegida) { Fondo = FLinearColor(0.50f, 0.10f, 0.10f); } }
				CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Fila(Q.O[o], FString(), [this, q, o]() { if (!EstResp.Contains(q)) { EstResp.Add(q, o); RehacerEstudio(); } }, Fondo) ];
			}
			if (Elegida)
			{
				const bool bBien = *Elegida == Q.A;
				CajaEst->AddSlot().AutoHeight().Padding(0, 5, 0, 0)[ Txt(D->TE(bBien ? TEXT("Correcto") : TEXT("Incorrecto")), 10, bBien ? FLinearColor(0.25f, 0.85f, 0.40f) : FLinearColor(1.f, 0.40f, 0.35f), true) ];
				if (!Q.X.IsEmpty()) { CajaEst->AddSlot().AutoHeight().Padding(0, 3, 0, 0)[ Txt(Q.X, 10, C_TINTA) ]; }
			}
		}
		if (It->Q.Num() > 1 && Hechas == It->Q.Num())
		{
			CajaEst->AddSlot().AutoHeight().Padding(0, 12, 0, 0)[ Txt(FString::Printf(TEXT("%s: %d / %d"), *D->TE(TEXT("Aciertos")), Aciertos, It->Q.Num()), 13, C_ACENTO, true) ];
		}
	}
	if (M.Id == TEXT("patologias") || M.Id == TEXT("casos") || M.Id == TEXT("protocolos")) { CajaEst->AddSlot().AutoHeight().Padding(0, 16, 0, 0)[ Txt(E.Aviso, 9, C_GRIS) ]; }
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