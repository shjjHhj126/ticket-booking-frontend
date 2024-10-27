import { useEffect, useRef, useState } from "react";
import ticketColorMap from "./data/ticketColorMap";
import { FaSearch } from "react-icons/fa";
import DropdownButton from "../../components/DropdownButton";
import { profileButton } from "./data/dropdownData";
import { useParams } from "react-router-dom";
import api from "../../config/apiconfig";
import { FaRegArrowAltCircleLeft } from "react-icons/fa";
import { IoEyeSharp } from "react-icons/io5";
import { FaMobileScreen } from "react-icons/fa6";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./components/payment";
import generateReservationID from "./util/generateReservationId";
import Slider from "@mui/material/Slider";

const TicketBooking = () => {
  const stripePromise = loadStripe(
    "pk_test_51P6qHpLlyIz5Ae8wfFsF1gPDL1T7cVHCoiOq0lG3VRwDa1gisyKtenqm560n3coCKLChkNYC7gZwhBZPOEZZbROq00BIHMRA9m"
  );
  const [clientSecret, setClientSecret] = useState("");
  const options = {
    clientSecret,
  };

  const [page, setPage] = useState(1);
  const [ticketNum, setTicketNum] = useState(2);
  const [price, setPrice] = useState([0, 1000]);

  const handlePriceChange = (e, newPrice) => {
    setPrice(newPrice);
  };

  const [shownCards, setShownCards] = useState([]);
  const { concertId } = useParams(); // is eventID ins backend
  const [tickets, setTickets] = useState([]);

  const [ws, setWs] = useState(null);

  // State for managing the view
  const [currentView, setCurrentView] = useState("selection"); // "selection", "confirmation", "login", "signup", "payment", "payment_success", "payment_failed"
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reservationResult, setReservationResult] = useState(null);
  const [curReservationId, setCurReservationId] = useState("");

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [loggedIn, setLoggedIn] = useState(false);

  // reserve ticket state
  const [reserveState, setReserveState] = useState("Reserve Now");

  // check login status
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const { data } = await api.get("/users/login-status");
        console.log(data);
        setLoggedIn(data.loggedIn);
      } catch (error) {
        setLoggedIn(false);
        console.log(error.response);
      }
    };
    checkLogin();
  }, []);

  // Create WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(import.meta.env.VITE_BACKEND_WS_URL); // Replace with your WebSocket server URL

    websocket.onopen = () => {
      // Send reservationId upon reconnect
      if (curReservationId) {
        websocket.send(
          JSON.stringify({
            action: "reconnect",
            reservationId: curReservationId,
          })
        );
      }
    };

    websocket.onmessage = (event) => {
      const data = event.data;
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket is closed");
    };

    setWs(websocket);

    // Cleanup function to close the WebSocket connection when the component unmounts
    return () => {
      websocket.close();
    };
  }, []);

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case "broadcast":
        handleBroadcastMessage(message.payload);
        break;
      case "reservation":
        handleReservationMessage(message.payload);
        break;
      case "error":
        handleErrorMessage(message.payload);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  };

  const handleBroadcastMessage = (payload) => {
    if (payload.messages) {
      const updatedTickets = tickets.filter((ticket) => {
        let shouldRemove = false;

        payload.messages.forEach((msg) => {
          if (
            msg.event_id === concertId &&
            msg.section_id === ticket.section_id &&
            msg.row_id === ticket.row_id &&
            msg.price === ticket.price &&
            msg.max_length < ticket.length
          ) {
            shouldRemove = true;
          }
        });

        return !shouldRemove;
      });

      setTickets(updatedTickets);
    }
  };

  const handleReservationMessage = (payload) => {
    console.log("Reservation message received:", payload);
    setClientSecret(payload.stripe_client_secret);
    setReservationResult(payload);
    setReserveState("Pay Now");
  };

  const handleErrorMessage = (payload) => {
    console.error("Error message received:", payload.message);
    setError(payload.message);
  };

  useEffect(() => {
    setShownCards(tickets);
  }, [tickets]);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data } = await api.get(
          `/events/${concertId}/tickets?number=${ticketNum}&low_price=${price[0]}&high_price=${price[1]}&page=${page}&page_size=6`
        );
        console.log("trigger");
        if (data) {
          setTickets(data);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };

    fetchTickets();
  }, [concertId, page, price, ticketNum]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [page, loading]);

  const handleScroll = async () => {
    if (!scrollContainerRef.current || loading) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const scrollThreshold = 5;

    if (scrollHeight - (scrollTop + clientHeight) < scrollThreshold) {
      setLoading(true);
      const nextPage = page + 1;
      const { data } = await api.get(
        `/events/${concertId}/tickets?number=${ticketNum}&low_price=${price[0]}&high_price=${price[1]}&page=${page}&page_size=6`
      );
      if (data) {
        setTickets((prev) => [...prev, ...data]);
      }
      setPage(nextPage);
      console.log("nextPage:", nextPage);
      setLoading(false);
    }
  };

  const handleTicketClick = (card) => {
    setSelectedTicket(card);
    setCurrentView("confirmation"); // Switch to confirmation view
  };

  const reserveTicket = (sectionId, rowId, price, length) => {
    const reserveTickets = async () => {
      const reservationId = generateReservationID();
      setCurReservationId(reservationId);

      const payload = {
        section_id: sectionId,
        row_id: rowId,
        price,
        length,
        reservation_id: reservationId,
      };
      try {
        setReserveState("pending");
        const { status, data } = await api.post(
          `/events/${concertId}/tickets/reserve`,
          payload
        );
        console.log(status, data);
        if (status === 200) {
          setReserveState("processing"); //in backend's mq
        } else {
          setError(data.error);
        }
      } catch (error) {
        console.error("Error reserving tickets:", error);
      }
    };
    reserveTickets();
  };

  const handlePay = async () => {
    if (loggedIn) {
      setCurrentView("payment");
    } else {
      try {
        const { data } = await api.get("/users/login-status");
        console.log(data);

        if (data.loggedIn) {
          setLoggedIn(true);
          setCurrentView("payment");
        } else {
          setLoggedIn(false);
          setCurrentView("login");
        }
      } catch (error) {
        setLoggedIn(false);
        console.error("Error fetching user status:", error);
        if (error.response && error.response.status === 401) {
          setCurrentView("login");
        } else {
          setError(error.response.message);
        }
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior

    const postData = {
      email,
      password,
    };

    try {
      await api.post("/users/login", postData);
      setCurrentView("payment");
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setCurrentView("signup");
      } else {
        setError(err.response.message);
      }
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior

    const postData = {
      username,
      email,
      password,
    };

    try {
      const { data } = await api.post("/users", postData);
      setCurrentView("payment");
    } catch (err) {
      // Handle any errors from the signup request
      console.log("Signup error:", err);
    }
  };

  return (
    <div className=" flex flex-col">
      {/* Header */}
      <section
        style={{ boxShadow: "0 0 5px 0 #B2BEB5" }}
        className="border flex items-center z-10 px-5 py-3">
        <img src="/images/company-icon.png" className="w-[100px]" />
        <div className="ml-10 flex-grow">
          <p className="font-bold leading-loose">
            <span className="text-[#0e8d93]">Dua Lipa</span> London Tickets
          </p>
          <p className="text-xs">
            Thu 17 Oct 2024 • 19:00 at{" "}
            <span className="text-[#0e8d93]">London Royal Albert Hall</span>,
            London, London
          </p>
          <div className="flex text-xs py-2 gap-1">
            <p className="bg-red-100 text-[#bf266b] rounded-full px-2 py-1">
              in two weeks
            </p>
            <p className="bg-gray-100 text-gray-600 rounded-full px-2 py-1">
              100 tickets left{/* Todo: backend get remain seats*/}
            </p>
          </div>
        </div>

        <div className="relative ml-4 flex items-center ">
          <FaSearch className="absolute left-3 text-[#3f1d75]" />
          <input
            type="text"
            placeholder="Event, artist or team"
            className="bg-gray-100 border-2 border-[#3f1d75] rounded-full pl-10 pr-4 py-2 focus:outline-none focus:bg-white"
          />
        </div>

        <DropdownButton data={profileButton} />
      </section>

      <section className="md:flex-1 flex flex-col md:flex-row  flex-wrap">
        {/* concert image */}
        <div className="flex-1 md:max-h-[580px] border border-solid">
          <img
            className="w-full h-full object-contain"
            src="/images/concertImage.png"
            alt="concert image"
          />
        </div>

        {/* Ticket Selection / Confirmation / Login / Signup / Payment / Result */}
        <div className="flex-1 max-h-[200px] md:max-h-[580px] overflow-hidden bg-[#f6f8f9] relative">
          {/* Ticket Selection Section */}
          {currentView === "selection" && shownCards && (
            <>
              <div className="absolute top-0 left-0 right-0 p-2 pr-4 z-10">
                <div className="flex flex-col gap-2 bg-[#e1e8eb] p-2">
                  <select
                    className="bg-white border rounded-md p-2 text-[#3f1d75] w-[100px]"
                    onChange={(e) => setTicketNum(e.target.value)}>
                    <option className="text-[#3f1d75]" value={ticketNum}>
                      {ticketNum} Tickets
                    </option>
                    {[1, 2, 3, 4, 5, 6]
                      .filter((num) => num != ticketNum)
                      .map((num) => (
                        <option
                          className="text-[#3f1d75]"
                          key={num}
                          value={num}>
                          {num} Ticket{num > 1 ? "s" : ""}
                        </option>
                      ))}
                  </select>

                  {/* Price Selection */}
                  <div className="flex w-full gap-4">
                    <p>NT${price[0]}</p>
                    <Slider
                      getAriaLabel={() => "Price range"}
                      value={price}
                      onChange={handlePriceChange}
                      valueLabelDisplay="off"
                      min={0}
                      max={1000}
                    />
                    <p>NT${price[1]}</p>
                  </div>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="ml-1 mr-4 mt-[100px] overflow-y-scroll h-[calc(100%-100px)]">
                {shownCards.map((card, idx) => {
                  return (
                    <div
                      key={idx}
                      id="card-bg"
                      style={{
                        backgroundColor: ticketColorMap.get(card.section),
                      }}
                      onClick={() => handleTicketClick(card)}
                      className="h-[90px] w-9/10 m-2 rounded-lg border-[1.5px] border-gray-300 hover:border-gray-500 hover:cursor-pointer">
                      <div className="bg-white ml-2 h-full flex flex-row justify-between p-2 rounded-e-lg rounded-s-md">
                        <div className="flex flex-col">
                          <p className="font-bold leading-loose text-lg">
                            Section : {card.section_name}
                          </p>
                          <p className="text-xs leading-relaxed">
                            Row : {card.row_name} | 2 tickets
                          </p>
                        </div>
                        <div className="flex flex-col">
                          <p className="font-bold leading-loose text-lg">
                            NT${card.price.toLocaleString("zh-TW")}
                          </p>
                          <p className="text-xs font-semibold leading-relaxed">
                            each
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="text-center p-4">Loading more tickets...</div>
                )}
              </div>
            </>
          )}
          {/* Reservation Confirmation Section */}
          {currentView === "confirmation" && selectedTicket && (
            <div className="p-6">
              <button
                className=""
                onClick={() => setCurrentView("selection")}
                disabled={reserveState != "Reserve Now"}>
                <FaRegArrowAltCircleLeft className="text-3xl text-[#3f1d75]" />
              </button>
              <div className="flex flex-col ">
                <div className="flex flex-col">
                  <div className="p-4">
                    <p className="text-lg font-semibold">
                      Section: {selectedTicket.section_name}
                    </p>
                    <p className="font-semibold">
                      Row: {selectedTicket.row_name}
                    </p>
                    <p className="text-gray-500 text-sm tracking-wider">
                      You&apos;ll get {2} seats together in this row.
                    </p>
                  </div>
                  <hr className=" border-gray-500" />
                  <div className="p-4">
                    <div>
                      <p className="text-lg font-semibold">Ticket Price</p>
                      <p className="text-green-600 text-2xl font-bold tracking-wide">
                        NT${selectedTicket.price.toLocaleString("zh-TW")}
                        <span className="ml-2 text-gray-700 text-lg font-normal">
                          each
                        </span>
                      </p>
                    </div>
                  </div>
                  <hr className=" border-gray-500" />
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <IoEyeSharp className="text-2xl text-[#3f1d75]" />
                      <p className="text-[#3f1d75] font-semibold">Clear view</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <FaMobileScreen className="text-2xl text-[#3f1d75]" />
                      <p className="text-[#3f1d75] font-semibold">
                        Mobile tickets
                      </p>
                    </div>
                  </div>
                </div>
                {reserveState == "Reserve Now" && (
                  <button
                    className="bg-[#3f1d75] text-white rounded-full px-2 py-1"
                    onClick={() =>
                      reserveTicket(
                        selectedTicket.section_id,
                        selectedTicket.row_id,
                        selectedTicket.price,
                        2 //Todo:make it a variable
                      )
                    }>
                    {reserveState}
                  </button>
                )}
                {reserveState === "Pay Now" && (
                  <button
                    className="bg-[#3f1d75] text-white rounded-full px-2 py-1"
                    onClick={handlePay}>
                    {reserveState}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Login Section */}
          {currentView === "login" && (
            <div className="p-6">
              <form className="px-2" onSubmit={handleLogin}>
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border rounded px-2 py-1"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border rounded px-2 py-1"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#3f1d75] text-white rounded-full w-full mt-3 px-2 py-1">
                  Log In
                </button>
              </form>

              <p className="text-[#3f1d75] hover:cursor-pointer px-3 py-1">
                No account? Click here
              </p>
            </div>
          )}
          {/* Signup Section */}
          {currentView === "signup" && (
            <div className=" p-4">
              <form className="px-2" onSubmit={handleSignup}>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="border rounded px-2 py-1"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border rounded px-2 py-1"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border rounded px-2 py-1"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#3f1d75] text-white rounded-full w-full mt-3 px-2 py-1">
                  Sign Up
                </button>
              </form>
            </div>
          )}

          {/* Payment Section */}
          {currentView === "payment" && options.clientSecret !== "" && (
            <div className="p-4">
              <Elements stripe={stripePromise} options={options}>
                <CheckoutForm setCurrentView={setCurrentView} />
              </Elements>
            </div>
          )}
          {/* Payment Success Section */}
          {currentView === "payment_success" && (
            <div className="flex flex-col items-center justify-center p-6 bg-green-100 border border-green-300 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-green-600 mb-4">
                Payment Succeeded!
              </h2>
              <p className="text-gray-700 mb-4">
                Thank you for your purchase! Your transaction was successful.
              </p>
              <button
                onClick={() => setCurrentView("selection")}
                className="bg-[#3f1d75] text-white rounded-full w-full py-2 px-4 transition duration-300 ease-in-out hover:bg-[#4a2395]">
                Book More Tickets
              </button>
            </div>
          )}

          {/* Payment Failed Section */}
          {currentView === "payment_failed" && (
            <div className="flex flex-col items-center justify-center p-6 bg-red-100 border border-red-300 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                Payment Failed!
              </h2>
              <p className="text-gray-700 mb-4">
                We&apos;re sorry, but your payment could not be processed.
              </p>
              <button
                onClick={() => setCurrentView("selection")}
                className="bg-[#3f1d75] text-white rounded-full w-full py-2 px-4 transition duration-300 ease-in-out hover:bg-[#4a2395]">
                Book Tickets Again
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TicketBooking;
