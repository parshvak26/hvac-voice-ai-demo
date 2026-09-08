import type { BookingFormOffer } from "@hvac-demo/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DemoCallClient } from "../types/demo-call";

interface BookingDetailsFormProps {
  client: DemoCallClient;
  offer: BookingFormOffer;
}

function dateRangeInAustin(): { minimum: string; maximum: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const minimum = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 30);
  return { minimum, maximum: date.toISOString().slice(0, 10) };
}

export function BookingDetailsForm({ client, offer }: BookingDetailsFormProps) {
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("Austin");
  const [region, setRegion] = useState("TX");
  const [postalCode, setPostalCode] = useState("");
  const [requestedDate, setRequestedDate] = useState(offer.suggestedDate ?? "");
  const [requestedTime, setRequestedTime] = useState(offer.suggestedTime ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "complete">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dateRange] = useState(dateRangeInAustin);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    try {
      await client.submitBookingDetails({
        token: offer.token,
        email,
        addressLine1,
        city,
        region,
        postalCode,
        requestedDate,
        requestedTime,
      });
      setStatus("complete");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(
        error instanceof Error ? error.message : "The details could not be saved.",
      );
    }
  };

  return (
    <div className="booking-details" ref={sectionRef}>
      <div className="booking-details__heading">
        <div>
          <p className="eyebrow">Secure post-call handoff</p>
          <h3>Complete your service request</h3>
        </div>
        <span>Demo step 2</span>
      </div>

      {status === "complete" ? (
        <div className="booking-success" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Details received securely</strong>
            <p>Your requested time was saved. No calendar event has been created yet.</p>
          </div>
        </div>
      ) : (
        <form className="booking-form" onSubmit={handleSubmit}>
          <p className="booking-details__intro">
            Confirm where service is needed and the time you want. Availability will be
            checked in the next demo step—this form does not book an appointment yet.
          </p>

          <div className="booking-form__grid">
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Street address
              <input
                type="text"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                autoComplete="address-line1"
                minLength={5}
                maxLength={200}
                required
              />
            </label>
            <label>
              City
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                autoComplete="address-level2"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <label>
              State
              <input
                type="text"
                value={region}
                onChange={(event) => setRegion(event.target.value.toUpperCase())}
                autoComplete="address-level1"
                pattern="[A-Za-z]{2}"
                maxLength={2}
                required
              />
            </label>
            <label>
              ZIP code
              <input
                type="text"
                inputMode="numeric"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                autoComplete="postal-code"
                pattern="[0-9]{5}"
                maxLength={5}
                required
              />
            </label>
            <label>
              Requested date
              <input
                type="date"
                value={requestedDate}
                onChange={(event) => setRequestedDate(event.target.value)}
                min={dateRange.minimum}
                max={dateRange.maximum}
                required
              />
            </label>
            <label>
              Requested time
              <input
                type="time"
                value={requestedTime}
                onChange={(event) => setRequestedTime(event.target.value)}
                min="08:00"
                max="18:00"
                step="1800"
                required
              />
            </label>
          </div>

          <p className="booking-timezone">Times use Austin time ({offer.timezone}).</p>
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
          <button className="primary-button booking-submit" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? (
              <><span className="button-spinner" aria-hidden="true" />Saving details…</>
            ) : "Save my details"}
          </button>
          <p className="booking-privacy">Your contact and address are kept private and are never shown in the public call result.</p>
        </form>
      )}
    </div>
  );
}
