export const sampleDesignPack = {
  meta: {
    name: 'genre-ui sample design pack',
    version: '0.1.0',
    source: 'manual-sample',
    createdAt: '2026-06-19T00:00:00.000Z'
  },
  themes: {
    lightnovel: {
      tokens: {
        colors: {
          primary: '#ff79b0',
          secondary: '#9153c6',
          accent: '#79c7ff',
          panel: 'rgba(255, 252, 255, 0.92)'
        },
        shape: {
          radius: '34px',
          cardRadius: '26px',
          badgeRadius: '999px'
        },
        shadow: {
          card: '0 16px 30px rgba(255, 121, 176, 0.14)'
        },
        surface: {
          panelGradient: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(252,244,255,0.84))'
        },
        ornament: {
          accentBar: 'linear-gradient(90deg, rgba(255,121,176,0.9), rgba(121,199,255,0.66))'
        },
        interaction: {
          hoverLift: '-2px'
        }
      },
      icons: {
        main: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M18 20C22.8 18.6 26.4 18.9 32 24C37.6 18.9 41.2 18.6 46 20V46C40.8 44.1 36.8 44.1 32 46C27.2 44.1 23.2 44.1 18 46V20Z"/><path d="M32 24V45"/><path d="M48 16L49.6 20L54 21.6L49.6 23.2L48 27.2L46.4 23.2L42 21.6L46.4 20L48 16Z"/></svg>',
        chapterStages: {
          opening: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M20 24L32 14L44 24V48H20V24Z"/><path d="M32 14V48"/></svg>'
        },
        characterRoles: {},
        worldElements: {},
        dividers: {
          ornate: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M6 32H24"/><circle cx="32" cy="32" r="4"/><path d="M40 32H58"/><circle cx="46" cy="24" r="1.5"/></svg>'
        },
        corners: {
          topLeft: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M16 52C16 28 28 16 52 16"/><path d="M26 52C26 34 34 26 52 26"/></svg>'
        }
      },
      components: {
        button: {
          summary: '圆角偏大，轻柔渐亮，适合角色感和便签感页面。'
        },
        card: {
          summary: '卡片适合插画位、角色卡和剧情便签布局。'
        }
      },
      pageTemplates: {
        showcase: {
          summary: '顶部角色焦点 + 中部卡片流 + 下方关系标签带。'
        }
      }
    },
    fantasy: {
      tokens: {
        colors: {
          primary: '#8f5a2c',
          secondary: '#3d5564',
          accent: '#d4b174',
          panel: 'rgba(252, 249, 243, 0.9)'
        },
        shape: {
          radius: '30px',
          cardRadius: '24px',
          badgeRadius: '18px'
        },
        shadow: {
          card: '0 20px 40px rgba(84, 62, 39, 0.16)'
        },
        surface: {
          panelGradient: 'linear-gradient(180deg, rgba(251,248,241,0.94), rgba(238,231,218,0.85))'
        },
        ornament: {
          accentBar: 'linear-gradient(90deg, rgba(143,90,44,0.95), rgba(212,177,116,0.7))'
        },
        interaction: {
          hoverLift: '-3px'
        }
      },
      icons: {
        main: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M32 12L48 22V42L32 52L16 42V22L32 12Z"/><path d="M32 18V46"/><path d="M24 26H40"/><path d="M24 36H40"/></svg>',
        chapterStages: {},
        characterRoles: {},
        worldElements: {},
        dividers: {
          ornate: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M6 32H24"/><path d="M24 32H28"/><rect x="28" y="24" width="8" height="8"/><path d="M36 32H40"/><path d="M40 32H58"/></svg>'
        },
        corners: {
          topLeft: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"><path d="M14 56V14H56"/><path d="M14 34H34V14"/></svg>'
        }
      },
      components: {
        button: {
          summary: '按钮像玉符或宗门令牌，边界更稳。'
        },
        card: {
          summary: '卡片适合卷轴、玉简、阵图式信息承载。'
        }
      },
      pageTemplates: {
        showcase: {
          summary: '顶部山门题头 + 中部章节推进 + 下部宗门与人物卡。'
        }
      }
    }
  }
};
