import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";
import api from "../../../config/apiconfig";

const CheckoutForm = ({ setCurrentView }) => {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    try {
      const { data } = api.post();
    } catch (e) {
      console.log(e);
    }
  }, []);

  const handleSubmit = async (event) => {
    // We don't want to let default form submission happen here,
    // which would refresh the page.
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      return;
    }

    const result = await stripe.confirmPayment({
      //`Elements` instance that was used to create the Payment Element
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      // Show error to your customer (for example, payment details incomplete)
      console.log(result.error.message);
      setCurrentView("payment_failed");
    } else {
      console.log("payment success!!!");
      setCurrentView("payment_success");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>Submit</button>
    </form>
  );
};

export default CheckoutForm;
