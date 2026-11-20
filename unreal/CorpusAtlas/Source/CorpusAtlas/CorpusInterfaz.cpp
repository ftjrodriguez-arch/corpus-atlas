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

namespace
{
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

SCorpusInterfaz::~SCorpusInterfaz()
{
	if (ACorpusCuerpo* C = Cuerpo()) { C->AlCambiarSeleccion.Remove(HSel); C->AlCambiarCapas.Remove(HCapas); }
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
		// ── Panel izquierdo: cuerpo, idioma y capas ──
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Fill).Padding(18.f)
		[
			SNew(SBox).WidthOverride(340.f)
			[
				SNew(SBorder).BorderImage(Panel()).Padding(16.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[ Txt(TEXT("CORPUS"), 22, C_TINTA, true) ]
					+ SVerticalBox::Slot().AutoHeight().Padding(0, 2, 0, 10)[ SAssignNew(CajaBarra, SVerticalBox) ]
					+ SVerticalBox::Slot().FillHeight(1.f)
					[
						SNew(SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaCapas, SVerticalBox) ]
					]
				]
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
		// ── Derecha: ficha de la estructura seleccionada ──
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(18.f)
		[
			SNew(SBox).WidthOverride(400.f).MaxDesiredHeight(860.f)
			.Visibility_Lambda([this]() { const ACorpusCuerpo* C = Cuerpo(); return C && !C->Seleccionada().IsEmpty() ? EVisibility::Visible : EVisibility::Collapsed; })
			[
				SNew(SBorder).BorderImage(Panel()).Padding(18.f)
				[
					SNew(SScrollBox) + SScrollBox::Slot()[ SAssignNew(CajaFicha, SVerticalBox) ]
				]
			]
		]
	];

	if (ACorpusCuerpo* C = Cuerpo())
	{
		HSel = C->AlCambiarSeleccion.AddSP(this, &SCorpusInterfaz::RehacerFicha);
		HCapas = C->AlCambiarCapas.AddSP(this, &SCorpusInterfaz::RehacerCapas);
	}
	if (UCorpusDatos* D = Datos()) { HIdioma = D->AlCambiarIdioma.AddSP(this, &SCorpusInterfaz::Reconstruir); }
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
	CajaBarra->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ FilaVistas ];

	RehacerCapas();
	RehacerFicha();
}

void SCorpusInterfaz::RehacerCapas()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaCapas.IsValid()) { return; }
	CajaCapas->ClearChildren();
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	FString Grupo;
	for (const FCorpusCapa& Capa : D->Capas())
	{
		if (!C->CapaDisponible(Capa.Clave)) { continue; }
		if (Capa.Grupo != Grupo)
		{
			Grupo = Capa.Grupo;
			CajaCapas->AddSlot().AutoHeight().Padding(0, 12, 0, 4)[ Txt(D->T(Grupo).ToUpper(), 9, C_GRIS, true) ];
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
	}
}

void SCorpusInterfaz::RehacerFicha()
{
	UCorpusDatos* D = Datos();
	ACorpusCuerpo* C = Cuerpo();
	if (!D || !C || !CajaFicha.IsValid()) { return; }
	CajaFicha->ClearChildren();
	const FString Id = C->Seleccionada();
	const FCorpusPieza* P = D->Pieza(Id);
	if (!P) { return; }
	TWeakObjectPtr<ACorpusCuerpo> WC(C);
	TWeakObjectPtr<ACorpusJugador> WJ(Jugador);

	CajaFicha->AddSlot().AutoHeight()[ Txt(D->NombrePieza(Id), 17, C_TINTA, true) ];
	if (!P->La.IsEmpty()) { CajaFicha->AddSlot().AutoHeight().Padding(0, 2, 0, 0)[ Txt(P->La, 11, C_GRIS) ]; }
	FString Sub = D->NombreCapa(P->Sistema);
	if (!P->Lado.IsEmpty()) { Sub += TEXT(" · ") + D->NombreLado(P->Lado); }
	CajaFicha->AddSlot().AutoHeight().Padding(0, 6, 0, 10)[ Txt(Sub, 10, C_ACENTO, true) ];

	CajaFicha->AddSlot().AutoHeight()
	[
		SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(6, 6))
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Encuadrar")), [WJ]() { if (WJ.IsValid()) { WJ->EncuadrarSeleccion(); } }, true) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Aislar")), [WC, Id]() { if (WC.IsValid()) { WC->Aislar(Id); } }) ]
		+ SWrapBox::Slot()[ Boton(D->T(TEXT("Ocultar")), [WC, Id]() { if (WC.IsValid()) { WC->Ocultar(Id); } }) ]
	];

	for (const TPair<FString, FString>& Campo : D->Ficha(Id))
	{
		CajaFicha->AddSlot().AutoHeight().Padding(0, 12, 0, 2)[ Txt(Campo.Key.ToUpper(), 9, C_GRIS, true) ];
		CajaFicha->AddSlot().AutoHeight()[ Txt(Campo.Value, 11, C_TINTA) ];
	}
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
