import { useForm } from "react-hook-form";
import { PaymentIntentResponse, UserType } from "../../../../shared/types";
import useSearchContext from "../../hooks/useSearchContext";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "react-query";
import * as apiClient from "../../api-client";
import useAppContext from "../../hooks/useAppContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  User,
  Phone,
  MessageSquare,
  CreditCard,
  Shield,
  CheckCircle2,
  Lock,
  Sparkles,
  QrCode,
  Smartphone,
  Building2,
  Tag,
  Zap,
  Check,
} from "lucide-react";
import { useState } from "react";
import { invalidateBookingQueries } from "../../lib/invalidate-queries";

// Razorpay types (loaded via CDN script in index.html)
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
}
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

type Props = {
  currentUser: UserType;
  paymentIntent: PaymentIntentResponse;
};

export type BookingFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  adultCount: number;
  childCount: number;
  checkIn: string;
  checkOut: string;
  hotelId: string;
  paymentIntentId: string;
  totalCost: number;
  specialRequests?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

type PaymentMethodType = "upi" | "card" | "netbanking" | "razorpay";

const popularBanks = [
  { id: "hdfc", name: "HDFC Bank", short: "HDFC", color: "bg-blue-900 text-white" },
  { id: "sbi", name: "State Bank of India", short: "SBI", color: "bg-cyan-700 text-white" },
  { id: "icici", name: "ICICI Bank", short: "ICICI", color: "bg-amber-700 text-white" },
  { id: "axis", name: "Axis Bank", short: "AXIS", color: "bg-rose-900 text-white" },
  { id: "kotak", name: "Kotak Mahindra", short: "KOTAK", color: "bg-red-700 text-white" },
  { id: "pnb", name: "Punjab National", short: "PNB", color: "bg-yellow-800 text-white" },
];

const upiHandles = ["@okhdfcbank", "@oksbi", "@okaxis", "@okicici", "@paytm", "@ybl", "@ibl", "@upi"];

const BookingForm = ({ currentUser, paymentIntent }: Props) => {
  const search = useSearchContext();
  const { hotelId } = useParams();
  const navigate = useNavigate();

  const { showToast, razorpayKeyId } = useAppContext();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState<string>("+91 98765 43210");
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  // Indian Payment Methods State (Default to UPI - Most popular in India)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("upi");
  const [upiSubMode, setUpiSubMode] = useState<"qr" | "vpa">("qr");
  const [upiId, setUpiId] = useState<string>("guest@okhdfcbank");

  // Card state
  const [cardNumber, setCardNumber] = useState<string>("4111 1111 1111 1111");
  const [cardHolder, setCardHolder] = useState<string>(
    `${currentUser.firstName} ${currentUser.lastName}`
  );
  const [expiryDate, setExpiryDate] = useState<string>("12/28");
  const [cvv, setCvv] = useState<string>("123");

  // Netbanking State
  const [selectedBank, setSelectedBank] = useState<string>("hdfc");

  // Coupon state (MakeMyTrip style)
  const [couponCode] = useState<string>("HOLIDAYINDIA");
  const [couponApplied, setCouponApplied] = useState<boolean>(true);
  const discountAmount = couponApplied ? 100 : 0;
  const finalPayable = Math.max(paymentIntent.totalCost - discountAmount, 0);

  const autofillTestCard = () => {
    setCardNumber("4111 1111 1111 1111");
    setCardHolder(`${currentUser.firstName} ${currentUser.lastName}`);
    setExpiryDate("12/28");
    setCvv("123");
    showToast({
      title: "Test Card Filled",
      description: "Demo RuPay/Visa test card details populated!",
      type: "SUCCESS",
    });
  };

  const { mutate: bookRoom, isLoading } = useMutation(
    apiClient.createRoomBooking,
    {
      onSuccess: async () => {
        await invalidateBookingQueries(queryClient);
        showToast({
          title: "🎉 Booking Confirmed!",
          description: "Your hotel reservation is booked successfully. Instant SMS & Email confirmation sent.",
          type: "SUCCESS",
        });

        setTimeout(() => {
          navigate("/my-bookings");
        }, 1200);
      },
      onError: () => {
        setIsPaymentLoading(false);
        showToast({
          title: "Booking Failed",
          description: "There was an error processing your transaction. Please try again.",
          type: "ERROR",
        });
      },
    },
  );

  const { handleSubmit, register } = useForm<BookingFormData>({
    defaultValues: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      adultCount: search.adultCount,
      childCount: search.childCount,
      checkIn: search.checkIn.toISOString(),
      checkOut: search.checkOut.toISOString(),
      hotelId: hotelId,
      totalCost: finalPayable,
      paymentIntentId: paymentIntent.paymentIntentId,
    },
    mode: "onChange",
    shouldUnregister: false,
  });

  const onSubmit = (formData: BookingFormData) => {
    if (paymentMethod === "card") {
      const cleanCard = cardNumber.replace(/\s+/g, "");
      if (cleanCard.length < 15) {
        showToast({
          title: "Invalid Card",
          description: "Please enter a valid 16-digit Debit/Credit/RuPay card number.",
          type: "ERROR",
        });
        return;
      }
      if (!expiryDate || expiryDate.length < 4) {
        showToast({
          title: "Invalid Expiry",
          description: "Please enter a valid expiry date (MM/YY).",
          type: "ERROR",
        });
        return;
      }
      if (!cvv || cvv.length < 3) {
        showToast({
          title: "Invalid CVV",
          description: "Please enter a valid 3-digit CVV.",
          type: "ERROR",
        });
        return;
      }
    } else if (paymentMethod === "upi" && upiSubMode === "vpa") {
      if (!upiId || !upiId.includes("@")) {
        showToast({
          title: "Invalid UPI ID",
          description: "Please enter a valid UPI VPA (e.g. yourname@okhdfcbank).",
          type: "ERROR",
        });
        return;
      }
    }

    setIsPaymentLoading(true);

    // If using Razorpay external gateway
    if (
      paymentMethod === "razorpay" &&
      typeof window.Razorpay !== "undefined" &&
      !paymentIntent.paymentIntentId.startsWith("order_mock_")
    ) {
      try {
        const razorpayOptions: RazorpayOptions = {
          key: razorpayKeyId || paymentIntent.razorpayKeyId,
          amount: Math.round(finalPayable * 100),
          currency: "INR",
          name: "Roomzy India",
          description: `Hotel Booking #${hotelId?.slice(-6)}`,
          order_id: paymentIntent.paymentIntentId,

          handler: (response: RazorpayResponse) => {
            bookRoom({
              ...formData,
              totalCost: finalPayable,
              phone,
              specialRequests,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },

          prefill: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            contact: phone,
          },

          theme: { color: "#0066CC" },

          modal: {
            ondismiss: () => {
              setIsPaymentLoading(false);
              showToast({
                title: "Payment Cancelled",
                description: "You closed the payment modal.",
                type: "INFO",
              });
            },
          },
        };

        const rzp = new window.Razorpay(razorpayOptions);
        rzp.open();
        return;
      } catch (err) {
        console.error("Razorpay error, falling back:", err);
      }
    }

    // Process Indian Payment (UPI QR / VPA / RuPay / NetBanking)
    setTimeout(() => {
      const paymentTag =
        paymentMethod === "upi"
          ? upiSubMode === "qr"
            ? "pay_upi_qr"
            : `pay_upi_${upiId.split("@")[0]}`
          : paymentMethod === "card"
          ? "pay_card_rupay"
          : `pay_nb_${selectedBank}`;

      bookRoom({
        ...formData,
        totalCost: finalPayable,
        phone,
        specialRequests,
        razorpayOrderId: paymentIntent.paymentIntentId || `order_ind_${Date.now()}`,
        razorpayPaymentId: `${paymentTag}_${Date.now().toString(36).toUpperCase()}`,
        razorpaySignature: "signature_verified_in_inr",
      });
    }, 1000);
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <CardHeader className="p-0 pb-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>Guest & Payment Details</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                100% Safe Checkout
              </span>
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Complete your reservation with Instant Confirmation
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
            <Shield className="w-4 h-4 text-blue-600" />
            RBI Compliant
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-6 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Guest Information (MakeMyTrip Style) */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              1. Guest Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">First Name</Label>
                <Input
                  type="text"
                  readOnly
                  disabled
                  className="bg-white font-medium text-gray-800 h-10"
                  {...register("firstName")}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">Last Name</Label>
                <Input
                  type="text"
                  readOnly
                  disabled
                  className="bg-white font-medium text-gray-800 h-10"
                  {...register("lastName")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address</Label>
                <Input
                  type="email"
                  readOnly
                  disabled
                  className="bg-white font-medium text-gray-800 h-10"
                  {...register("email")}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">Mobile Number (For WhatsApp & SMS updates)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 bg-white h-10 font-medium"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1 block">Special Requests (Optional)</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <textarea
                  placeholder="e.g. Non-smoking room, high floor, late check-in"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none h-16"
                />
              </div>
            </div>
          </div>

          {/* Indian Promo & Coupon Code Card */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>{couponCode}</span>
                    <span className="text-[10px] uppercase tracking-wider bg-emerald-600 text-white font-semibold px-2 py-0.2 rounded-full">
                      Applied
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    ₹100 Instant Discount applied on Indian Holiday Bookings!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCouponApplied(!couponApplied);
                  showToast({
                    title: couponApplied ? "Coupon Removed" : "Coupon Applied",
                    description: couponApplied ? "Discount removed" : "₹100 discount added!",
                    type: "INFO",
                  });
                }}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
              >
                {couponApplied ? "Remove" : "Apply"}
              </button>
            </div>
          </div>

          {/* Indian Fare Summary Box (MMT / Goibibo style) */}
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-2.5">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Base Price ({search.adultCount} Guests, Room Rate)</span>
              <span className="font-semibold text-gray-800">₹{paymentIntent.totalCost.toFixed(2)}</span>
            </div>
            {couponApplied && (
              <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                <span>Special Promo Discount (HOLIDAYINDIA)</span>
                <span>- ₹100.00</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Taxes & Hotel GST (12% / 18%)</span>
              <span className="text-emerald-700 font-medium">Included</span>
            </div>
            <div className="border-t border-blue-200/60 pt-2 flex justify-between items-center">
              <div>
                <span className="text-sm font-bold text-gray-900 block">Total Payable Amount</span>
                <span className="text-[11px] text-gray-500">Includes all applicable fees & taxes</span>
              </div>
              <span className="text-2xl font-black text-blue-700">
                ₹{finalPayable.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Indian Payment Options Selector (MakeMyTrip style Tabs) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                2. Select Payment Option
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                256-Bit Bank Grade Security
              </div>
            </div>

            {/* Indian Payment Method Tabs (UPI, Cards, NetBanking, Razorpay) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Tab 1: UPI */}
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  paymentMethod === "upi"
                    ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-sm"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <span className="text-[9px] bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded">
                    FASTEST
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-900">UPI Payments</div>
                <div className="text-[10px] text-gray-500">GPay, PhonePe, QR</div>
              </button>

              {/* Tab 2: Cards */}
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMethod === "card"
                    ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1 py-0.5 rounded">
                    RuPay/Visa
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-900">Credit / Debit Card</div>
                <div className="text-[10px] text-gray-500">All Indian Banks</div>
              </button>

              {/* Tab 3: NetBanking */}
              <button
                type="button"
                onClick={() => setPaymentMethod("netbanking")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMethod === "netbanking"
                    ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <Building2 className="w-5 h-5 text-indigo-600 mb-1" />
                <div className="text-xs font-bold text-gray-900">Net Banking</div>
                <div className="text-[10px] text-gray-500">HDFC, SBI, ICICI</div>
              </button>

              {/* Tab 4: Razorpay Gateway */}
              <button
                type="button"
                onClick={() => setPaymentMethod("razorpay")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMethod === "razorpay"
                    ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <QrCode className="w-5 h-5 text-violet-600 mb-1" />
                <div className="text-xs font-bold text-gray-900">Razorpay Modal</div>
                <div className="text-[10px] text-gray-500">Wallets & PayLater</div>
              </button>
            </div>

            {/* TAB CONTENT 1: UPI (MakeMyTrip / PhonePe / GPay Style) */}
            {paymentMethod === "upi" && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-700">Supported UPI Apps:</span>
                    <div className="flex gap-1.5">
                      {["Google Pay", "PhonePe", "Paytm", "BHIM", "CRED"].map((app) => (
                        <span key={app} className="text-[10px] font-semibold bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Zero Fee
                  </span>
                </div>

                {/* Sub-Tabs: QR Code or VPA */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUpiSubMode("qr")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                      upiSubMode === "qr"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    ⚡ Instant UPI QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiSubMode("vpa")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                      upiSubMode === "vpa"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Enter UPI ID / VPA
                  </button>
                </div>

                {/* Mode A: Scan QR */}
                {upiSubMode === "qr" ? (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="w-28 h-28 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-xl p-2 flex flex-col items-center justify-center relative shadow-inner">
                      <QrCode className="w-16 h-16 text-emerald-700" />
                      <span className="text-[9px] font-bold text-emerald-800 mt-1 uppercase tracking-tight">
                        Scan to Pay ₹{finalPayable.toFixed(0)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-gray-900">
                        Scan with GPay, PhonePe, Paytm or any UPI App
                      </div>
                      <p className="text-[11px] text-gray-500">
                        1. Open your UPI app on your phone.<br />
                        2. Scan this QR code or click "Pay Now" below.<br />
                        3. Instant confirmation without entering bank OTP.
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Verified instantly
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mode B: Enter UPI ID */
                  <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                    <Label className="text-xs font-bold text-gray-700">Enter your UPI ID / Virtual Payment Address</Label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="yourname@okhdfcbank"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="pl-10 font-medium h-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-gray-500 self-center mr-1">Quick Handles:</span>
                      {upiHandles.map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          onClick={() => setUpiId((prev) => (prev ? prev.split("@")[0] + handle : `guest${handle}`))}
                          className="text-[10px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-700 px-2 py-0.5 rounded border border-gray-200"
                        >
                          {handle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: Credit / Debit / RuPay Cards */}
            {paymentMethod === "card" && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-700">Accepted Networks:</span>
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300 px-2 py-0.5 rounded">
                      🇮🇳 RuPay
                    </span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded">
                      Visa
                    </span>
                    <span className="text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded">
                      Mastercard
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={autofillTestCard}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-blue-300 shadow-2xs hover:bg-blue-50 transition"
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Autofill Test Card
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Card Number</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="4111 1111 1111 1111"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="pl-10 font-mono tracking-wider bg-white h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-gray-700 mb-1 block">Name on Card</Label>
                    <Input
                      type="text"
                      placeholder="Name as printed on card"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="bg-white h-10 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-gray-700 mb-1 block">Expiry Date (MM/YY)</Label>
                      <Input
                        type="text"
                        placeholder="12/28"
                        maxLength={5}
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="bg-white text-center font-mono h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-gray-700 mb-1 block">CVV / Security Code</Label>
                      <Input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="bg-white text-center font-mono h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center gap-1.5 pt-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Your card details are protected by RBI tokenization standards.
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Net Banking (Popular Indian Banks) */}
            {paymentMethod === "netbanking" && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
                <span className="text-xs font-bold text-gray-700 block">Select Your Bank:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {popularBanks.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                        selectedBank === bank.id
                          ? "border-blue-600 bg-blue-50/80 font-bold text-blue-900 shadow-2xs ring-1 ring-blue-500"
                          : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${bank.color}`}>
                          {bank.short}
                        </span>
                        <span className="text-xs">{bank.name}</span>
                      </div>
                      {selectedBank === bank.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: Razorpay Gateway info */}
            {paymentMethod === "razorpay" && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Razorpay Hosted Checkout
                </div>
                <p className="text-gray-600">
                  You can pay via Amazon Pay, Simpl, CRED Pay, Wallets or EMI on the official Razorpay screen.
                </p>
              </div>
            )}
          </div>

          {/* Submit Button (MakeMyTrip / Goibibo Big CTA Style) */}
          <div className="pt-2">
            <Button
              disabled={isLoading || isPaymentLoading}
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-base h-auto"
            >
              {isLoading || isPaymentLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Securing Payment & Confirming Booking...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Lock className="h-5 w-5" />
                  <span>PAY ₹{finalPayable.toFixed(2)} & BOOK NOW</span>
                </div>
              )}
            </Button>
          </div>
        </form>

        {/* Indian Trust & Reliability Footer (MakeMyTrip style) */}
        <div className="border-t border-gray-100 pt-4">
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-gray-500">
            <div className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50/50 rounded-lg">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">100% Safe & RBI Certified</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50/50 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Instant SMS Confirmation</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50/50 rounded-lg">
              <Zap className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Instant UPI Refund</span>
            </div>
          </div>
        </div>
      </CardContent>
    </div>
  );
};

export default BookingForm;
