# Indian Localisation and Canonical Sample Data

## Formats

All formatting goes through `apps/web/src/utils/format.ts` (locale `en-IN`). Never format inline.

| Kind | Helper | Example |
| --- | --- | --- |
| Currency | `formatCurrency` | ₹1,25,000.00 (lakh grouping: 1,00,000; crore: 1,00,00,000) |
| Currency, compact (chart axes only) | `formatCurrencyCompact` *(to add)* | ₹1.2L, ₹45K, ₹1.1Cr |
| Number | `formatNumber` | 1,25,000 |
| Distance | `formatDistance` | 8,450 km |
| Volume | `formatVolume` | 30 L, 28.4 L |
| Efficiency | `formatEfficiency` | 17.8 km/L |
| Date | `formatDate` | 27/11/2026 (DD/MM/YYYY; never MM/DD or ISO in UI) |
| Date-time | `formatDateTime` | 27/11/2026, 9:30 AM (12-hour with AM/PM) |
| Missing | `EMPTY_VALUE` | — |

- **Relative time** in lists and notifications: "2 hours ago", "Yesterday", then the date. Use date-fns `formatDistanceToNowStrict` behind a helper in `format.ts`.
- **Relative due dates:** "in 43 days", "Due today", "3 days overdue". Distance-based: "in 1,550 km", "200 km overdue".
- **Month labels on charts:** "Nov", "Nov 26" (date-fns `MMM` / `MMM yy`). Periods are written "November 2026".
- **Rates:** "₹94.85/L", "₹5.33/km".
- **Timezone:** Asia/Kolkata. Dates come from the API and display in the user's preference.

## Indian context to reflect in the UI

- **Fuel types:** Petrol, Diesel, CNG, Electric, Hybrid. CNG is measured in kg (km/kg), and EV in kWh (km/kWh). Labels and units follow the vehicle's fuel type.
- **Documents:** RC (Registration Certificate), Insurance (third-party or comprehensive), PUC (Pollution Under Control), Driving Licence, Warranty, Roadside Assistance, loan documents, invoices.
- **Expenses:** Tolls (FASTag), Parking, Fines and challans, Registration and road tax, Washing.
- **Payment methods:** UPI, Card, Cash, FASTag (tolls), Net banking, Wallet.
- **Registration format:** `SS NN XX NNNN` (state code, RTO number, series, number), displayed with spaces and uppercase (`HR 26 AB 1234`). Input accepts any spacing or hyphens and normalises them.
- **Spelling:** kilometres, litres, licence, tyres, colour, organise, programme (not "program" for schemes).

## Canonical sample data

Use these values for all mockups, placeholders, stories, tests that need realistic UI data and design examples. Don't invent conflicting numbers. If a screen needs a value that isn't listed, derive it from these or add it here first.

**Owner:** Aarav Sharma (fictional), Gurugram, Haryana. Today = **27/11/2026**.

### Primary vehicle

| Field | Value |
| --- | --- |
| Make / Model / Variant | Maruti Suzuki · Victoris · LXI |
| Fuel / Transmission | Petrol · Manual |
| Registration | HR 26 AB 1234 (pattern HR-XX-XX-XXXX) |
| Purchased / delivered | 14/03/2026 at 12 km |
| Current odometer | **8,450 km** (last reading 26/11/2026, from a trip end) |
| Distance owned | 8,438 km |
| Odometer on 31/10/2026 | 7,430 km → **November distance 1,020 km** |
| Ownership | Loan: on-road price ₹12,10,000; down payment ₹4,10,000; loan ₹8,00,000 at 9.2% for 60 months |
| EMI | ₹16,684 from April 2026; 8 paid = ₹1,33,472 (interest ₹46,767 · principal ₹86,705 · outstanding ₹7,13,295) |
| Resale estimate | ₹10,40,000 → depreciation ₹1,70,000 |

### Fuel

| Field | Value |
| --- | --- |
| Petrol price | ₹94.85/L |
| Avg mileage | **17.8 km/L**, from 12 full-tank fills (15 fill-ups in total, 3 partial) |
| Fill on 06/11/2026 | 7,560 km · 28.40 L · ₹2,693.74 · Full · Indian Oil, Sector 29 · UPI |
| Fill on 19/11/2026 | 8,106 km · 30.00 L · ₹2,845.50 · Full · 18.2 km/L (546 km) · Card |
| November fuel | 58.40 L · **₹5,539.24** |
| Lifetime fuel | 474.0 L · ₹44,958.90 |
| Fuel cost per km | ₹5.33 |

### Expenses since purchase (operating)

| Category | Amount |
| --- | --- |
| Fuel | ₹44,958.90 |
| Insurance (comprehensive, 14/03/2026–13/03/2027) | ₹38,500.00 |
| Maintenance (2nd service, 5,000 km, 08/08/2026) | ₹1,950.00 |
| Accessories | ₹12,400.00 |
| Tolls (FASTag) | ₹2,640.00 |
| Parking | ₹960.00 |
| Washing | ₹1,800.00 |
| Loan interest (8 EMIs) | ₹46,767.00 |
| **Operating cost** | **₹1,49,975.90** → **₹17.77/km** over 8,438 km |
| Loan principal (not an ownership cost) | ₹86,705.00 |
| **Cash outflow** (excluding down payment) | **₹2,36,680.90** |
| **Economic ownership cost** (operating + depreciation) | **₹3,19,975.90** |

### Maintenance and documents

| Item | Value |
| --- | --- |
| Next periodic service | at 10,000 km or 14/03/2027, whichever is first → 1,550 km / 107 days left → **Upcoming** |
| Air filter | **Needs inspection** (dusty-route note) |
| Component summary | Overdue 0 · Due 0 · Needs inspection 1 · Upcoming 2 · Good 9 (12 components) |
| Insurance expiry | 13/03/2027 → 106 days → Valid |
| PUC expiry | 13/03/2027 → Valid |
| Driving Licence (personal) | expires 09/01/2027 → 43 days → Valid; reminder at 30 days |
| RC | valid until 13/03/2041 |

### Secondary vehicle (multi-vehicle examples)

Hyundai Creta · SX(O) · Diesel · Automatic · **DL 8C AB 5678** · odometer **42,180 km** · avg 15.6 km/L · purchased 02/08/2022 · owned outright.

Other makes you may use in lists and search examples, without detailed figures: Tata Nexon, Mahindra XUV700, Honda City, Toyota Innova.

### Consistency rules

- One vehicle shows one odometer value everywhere at a given moment.
- Monthly figures are for November 2026 unless the date range says otherwise. Comparisons are vs October 2026.
- Totals must equal the sum of their parts, and cost per km = operating cost ÷ distance owned.
- Never put loan principal inside operating cost or cost per km.
