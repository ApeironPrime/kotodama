import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        mode: 'dark',

        primary: {
            main: '#C62828',
            dark: '#8E0000',
            light: '#EF5350',
            contrastText: '#FFFFFF',
        },

        secondary: {
            main: '#F5F1E8',
            contrastText: '#0F0F0F',
        },

        background: {
            default: '#0F0F0F',
            paper: '#181818',
        },

        text: {
            primary: '#F5F5F5',
            secondary: '#A0A0A0',
        },

        divider: '#2A2A2A',
    },

    typography: {
        fontFamily: [
            'Inter',
            'Noto Sans JP',
            'Roboto',
            'Helvetica',
            'Arial',
            'sans-serif',
        ].join(','),

        h1: {
            fontWeight: 700,
        },

        h2: {
            fontWeight: 700,
        },

        h3: {
            fontWeight: 700,
        },

        h4: {
            fontWeight: 700,
        },

        h5: {
            fontWeight: 600,
        },

        h6: {
            fontWeight: 600,
        },

        body1: {
            fontWeight: 400,
        },

        body2: {
            fontWeight: 400,
        },

        button: {
            fontWeight: 600,
            textTransform: 'none',
        },
    },

    shape: {
        borderRadius: 12,
    },

    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },

            styleOverrides: {
                root: {
                    borderRadius: 10,
                },
            },
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid',
                },
            },
        },
    },
});