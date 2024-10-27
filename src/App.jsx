import { BrowserRouter, Routes, Route } from "react-router-dom";
import TicketBooking from "./pages/ticketBooking/TicketBooking";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/artist/:artist/concerts/:concertId"
          element={<TicketBooking />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
