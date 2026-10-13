import { Route, Routes } from "react-router-dom";
import Workspace from "../pages/shared/Workspace";
import { screenRoutes } from "../pages/shared/registry";

export { screenRegistry, screenRoutes } from "../pages/shared/registry";

/** One persistent workspace owns menu navigation, device boundaries and tab state. */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Workspace />}>
        <Route index element={<></>} />
        {screenRoutes.map((route) => (
          <Route key={route} path={route.slice(1)} element={<></>} />
        ))}
        <Route path="*" element={<></>} />
      </Route>
    </Routes>
  );
}

export default AppRouter;
