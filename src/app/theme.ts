import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        mode: 'dark',

        primary: {
            main: '#d32f2f',
        },

        background: {
            default: '#0f0f0f',
            paper: '#181818',
        },

        text: {
            primary: '#ffffff',
            secondary: '#bdbdbd',
        },

        divider: '#2a2a2a',
    },

    typography: {
        fontFamily: [
            'Inter',
            'system-ui',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'sans-serif',
        ].join(','),
    },

    shape: {
        borderRadius: 8,
    },

    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },

            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                },
            },
        },
    },
});