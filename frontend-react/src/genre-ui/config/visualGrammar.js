export const genreVisualGrammar = {
  urban: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(238,244,252,0.78))',
      cardGradient: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(239,245,255,0.84))',
      overlay: 'linear-gradient(135deg, rgba(111,182,255,0.08), transparent 55%)',
      shadow: '0 22px 46px rgba(31, 66, 124, 0.14)',
      glow: '0 20px 42px rgba(111, 182, 255, 0.16)'
    },
    shape: {
      radius: '32px',
      cardRadius: '26px',
      buttonRadius: '18px',
      badgeRadius: '999px',
      borderWidth: '1px',
      edgeStyle: 'glass'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(47,108,229,0.95), rgba(111,182,255,0.48))',
      divider: 'linear-gradient(90deg, transparent, rgba(47,108,229,0.48), transparent)',
      corner: 'glass-notch',
      pattern: 'radial-gradient(circle at top right, rgba(111,182,255,0.08), transparent 40%)',
      headerMark: 'glass-slit'
    },
    interaction: {
      hoverLift: '-3px',
      hoverGlow: '0 18px 38px rgba(111, 182, 255, 0.18)',
      hoverBorder: 'rgba(47,108,229,0.34)',
      activeRing: 'rgba(47,108,229,0.26)'
    }
  },
  fantasy: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(251,248,241,0.94), rgba(238,231,218,0.85))',
      cardGradient: 'linear-gradient(180deg, rgba(255,250,242,0.96), rgba(240,229,210,0.82))',
      overlay: 'linear-gradient(160deg, rgba(212,177,116,0.12), transparent 52%)',
      shadow: '0 24px 48px rgba(84, 62, 39, 0.14)',
      glow: '0 22px 44px rgba(169, 132, 76, 0.18)'
    },
    shape: {
      radius: '30px',
      cardRadius: '24px',
      buttonRadius: '18px',
      badgeRadius: '18px',
      borderWidth: '1.5px',
      edgeStyle: 'heavy'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(143,90,44,0.95), rgba(212,177,116,0.7))',
      divider: 'linear-gradient(90deg, transparent, rgba(143,90,44,0.54), transparent)',
      corner: 'stone-fold',
      pattern: 'radial-gradient(circle at 18% 18%, rgba(212,177,116,0.12), transparent 42%)',
      headerMark: 'stone-rune'
    },
    interaction: {
      hoverLift: '-3px',
      hoverGlow: '0 18px 40px rgba(169, 132, 76, 0.2)',
      hoverBorder: 'rgba(143,90,44,0.34)',
      activeRing: 'rgba(212,177,116,0.3)'
    }
  },
  scifi: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(15,25,41,0.95), rgba(20,31,48,0.86))',
      cardGradient: 'linear-gradient(180deg, rgba(18,28,45,0.98), rgba(13,22,36,0.86))',
      overlay: 'linear-gradient(135deg, rgba(76,200,255,0.12), transparent 54%)',
      shadow: '0 24px 52px rgba(2, 9, 19, 0.36)',
      glow: '0 20px 46px rgba(76, 200, 255, 0.18)'
    },
    shape: {
      radius: '28px',
      cardRadius: '20px',
      buttonRadius: '16px',
      badgeRadius: '12px',
      borderWidth: '1px',
      edgeStyle: 'hud'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(76,200,255,0.95), rgba(158,243,180,0.62))',
      divider: 'linear-gradient(90deg, transparent, rgba(76,200,255,0.6), transparent)',
      corner: 'signal-cut',
      pattern: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0) 40%), radial-gradient(circle at 82% 18%, rgba(76,200,255,0.08), transparent 34%)',
      headerMark: 'hud-notch'
    },
    interaction: {
      hoverLift: '-4px',
      hoverGlow: '0 18px 44px rgba(76, 200, 255, 0.2)',
      hoverBorder: 'rgba(76,200,255,0.42)',
      activeRing: 'rgba(158,243,180,0.28)'
    }
  },
  mystery: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(24,29,36,0.96), rgba(16,19,24,0.88))',
      cardGradient: 'linear-gradient(180deg, rgba(30,35,42,0.98), rgba(20,24,31,0.88))',
      overlay: 'linear-gradient(150deg, rgba(181,140,89,0.08), transparent 54%)',
      shadow: '0 24px 48px rgba(4, 6, 10, 0.36)',
      glow: '0 18px 40px rgba(110, 163, 199, 0.14)'
    },
    shape: {
      radius: '28px',
      cardRadius: '20px',
      buttonRadius: '14px',
      badgeRadius: '10px',
      borderWidth: '1px',
      edgeStyle: 'dossier'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(181,140,89,0.72), rgba(110,163,199,0.36))',
      divider: 'linear-gradient(90deg, transparent, rgba(181,140,89,0.44), transparent)',
      corner: 'seal-strip',
      pattern: 'linear-gradient(0deg, rgba(255,255,255,0.015), rgba(255,255,255,0.015)), radial-gradient(circle at 12% 10%, rgba(181,140,89,0.06), transparent 38%)',
      headerMark: 'seal-strip'
    },
    interaction: {
      hoverLift: '-2px',
      hoverGlow: '0 16px 34px rgba(9, 12, 16, 0.34)',
      hoverBorder: 'rgba(181,140,89,0.28)',
      activeRing: 'rgba(110,163,199,0.24)'
    }
  },
  game: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(24,31,49,0.96), rgba(16,21,33,0.88))',
      cardGradient: 'linear-gradient(180deg, rgba(24,31,49,0.98), rgba(12,17,28,0.86))',
      overlay: 'linear-gradient(140deg, rgba(82,199,255,0.12), transparent 56%)',
      shadow: '0 24px 52px rgba(5, 9, 17, 0.34)',
      glow: '0 18px 42px rgba(82, 199, 255, 0.18)'
    },
    shape: {
      radius: '26px',
      cardRadius: '18px',
      buttonRadius: '14px',
      badgeRadius: '10px',
      borderWidth: '1px',
      edgeStyle: 'hud'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(82,199,255,0.95), rgba(121,243,198,0.66))',
      divider: 'linear-gradient(90deg, transparent, rgba(82,199,255,0.62), transparent)',
      corner: 'hud-frame',
      pattern: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), radial-gradient(circle at 82% 16%, rgba(121,243,198,0.08), transparent 35%)',
      headerMark: 'hud-notch'
    },
    interaction: {
      hoverLift: '-4px',
      hoverGlow: '0 18px 46px rgba(82, 199, 255, 0.22)',
      hoverBorder: 'rgba(82,199,255,0.42)',
      activeRing: 'rgba(121,243,198,0.28)'
    }
  },
  lightnovel: {
    surface: {
      panelGradient: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(252,244,255,0.84))',
      cardGradient: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,239,255,0.82))',
      overlay: 'linear-gradient(150deg, rgba(255,121,176,0.1), transparent 55%)',
      shadow: '0 18px 34px rgba(145, 83, 198, 0.12)',
      glow: '0 16px 36px rgba(255, 121, 176, 0.16)'
    },
    shape: {
      radius: '34px',
      cardRadius: '26px',
      buttonRadius: '999px',
      badgeRadius: '999px',
      borderWidth: '1px',
      edgeStyle: 'soft'
    },
    ornament: {
      accentBar: 'linear-gradient(90deg, rgba(255,121,176,0.9), rgba(121,199,255,0.66))',
      divider: 'linear-gradient(90deg, transparent, rgba(255,121,176,0.4), transparent)',
      corner: 'ribbon-soft',
      pattern: 'radial-gradient(circle at 84% 18%, rgba(255,121,176,0.08), transparent 36%), radial-gradient(circle at 18% 82%, rgba(121,199,255,0.08), transparent 32%)',
      headerMark: 'stardust'
    },
    interaction: {
      hoverLift: '-2px',
      hoverGlow: '0 14px 30px rgba(255, 121, 176, 0.16)',
      hoverBorder: 'rgba(255,121,176,0.28)',
      activeRing: 'rgba(145,83,198,0.2)'
    }
  }
};
