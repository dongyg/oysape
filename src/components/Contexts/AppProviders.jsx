import { ThemeProvider } from './CustomContext';

const AppProviders = ({ children }) => {
  return <ThemeProvider>
    { children }
  </ThemeProvider>
}
export default AppProviders;
