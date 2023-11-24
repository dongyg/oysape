
import React from "react";
import { createRoot } from 'react-dom/client';
// import reportWebVitals from './reportWebVitals';

import './index.sass'

import AppRoot from './components/Common/AppRoot';
import AppProviders from './components/Contexts/AppProviders'

const App = function () {
  return (
    <AppProviders>
      <AppRoot />
    </AppProviders>
  )
}

const root = createRoot(document.getElementById("app"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


export default App


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
