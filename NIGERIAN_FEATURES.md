# Nigerian Healthcare Customization Features

## Summary of Implementation

This document describes the Nigerian healthcare customization features added to the HMS backend.

---

## 1. Database Schema Updates

### BillingRecord Model (Insurance/NHIS Support)
Added three new optional fields to support National Health Insurance Scheme (NHIS):

```prisma
insuranceProvider    String?  // e.g., "NHIS", "HydiaHMO", "Leadway"
insurancePolicyNumber String?  // Patient's policy/card number
insuranceCoverage    Float?   // Percentage covered (0-100)
```

**Migration:** Applied via `npx prisma db push --accept-data-loss`

---

## 2. Hospital Settings Structure

The `Hospital.settings` JSON field now supports comprehensive Nigerian hospital configuration:

```typescript
{
  // Localization
  currency: 'NGN',
  currencySymbol: '₦',
  locale: 'en-NG',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',

  // Departments (Nigerian context)
  departments: [
    'General Medicine', 'Cardiology', 'Pediatrics',
    'Obstetrics & Gynaecology', 'Surgery', 'Orthopaedics',
    'ENT', 'Ophthalmology', 'Dermatology', 'Dental',
    'Radiology', 'Physiotherapy'
  ],

  // Pricing (in Naira)
  consultationFee: 5000,
  registrationFee: 2000,

  // NHIS Configuration
  nhisEnabled: true,
  nhisProviders: [
    'NHIS', 'HydiaHMO', 'Leadway',
    'AXA Mansard', 'Hygeia', 'Reliance'
  ],

  // Legal
  taxId: '',
  rcNumber: '', // CAC Registration Number

  // Address
  address: {
    street: '45 Awolowo Road',
    city: 'Lagos',
    state: 'Lagos State',
    country: 'Nigeria'
  },

  // Branding
  branding: {
    primaryColor: '#0D7C66',
    secondaryColor: '#F5A623',
    logoUrl: '',
    hospitalName: 'City General Hospital',
    tagline: 'Quality Healthcare for All'
  },

  // Feature Flags
  features: {
    pharmacy: true,
    lab: true,
    billing: true,
    ipd: true,
    nursing: true,
    appointments: false,
    telemedicine: false
  },

  // Payment Methods
  paymentMethods: ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY'],
  mobileMoneyProviders: ['OPay', 'PalmPay', 'Paga', 'Kuda']
}
```

---

## 3. New API Endpoints

### Settings Controller (`src/controllers/settingsController.ts`)

#### `GET /api/v1/settings`
- **Public Route** (no authentication required)
- Returns public branding info for unauthenticated requests
- Returns full settings for authenticated users (scoped to their hospital)
- Super admins can query any hospital with `?hospitalId=xxx`

**Response (Public):**
```json
{
  "branding": {
    "hospitalName": "City General Hospital",
    "primaryColor": "#0D7C66",
    "secondaryColor": "#F5A623",
    "logoUrl": "",
    "tagline": "Quality Healthcare for All"
  }
}
```

**Response (Authenticated):**
```json
{
  "hospital": {
    "id": "...",
    "name": "City General Hospital",
    "address": "45 Awolowo Road, Ikoyi, Lagos State",
    "phone": "+234 803 456 7890",
    "email": "contact@cityhospital.com",
    "logo": null
  },
  "settings": { /* full settings object */ }
}
```

#### `PUT /api/v1/settings`
- **Protected:** ADMIN, SUPER_ADMIN only
- Updates hospital settings (merges with existing, doesn't replace)
- Creates audit log

**Request Body:**
```json
{
  "settings": {
    "consultationFee": 6000,
    "nhisEnabled": true
  }
}
```

#### `GET /api/v1/settings/departments`
- **Protected:** Authenticated users
- Returns list of departments for the hospital
- Falls back to default list if not configured

**Response:**
```json
{
  "departments": [
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    ...
  ]
}
```

#### `PUT /api/v1/settings/branding`
- **Protected:** ADMIN, SUPER_ADMIN only
- Updates hospital branding specifically
- Creates audit log

**Request Body:**
```json
{
  "primaryColor": "#0D7C66",
  "secondaryColor": "#F5A623",
  "logoUrl": "https://...",
  "hospitalName": "Lagos General Hospital",
  "tagline": "Healthcare Excellence"
}
```

---

## 4. Dashboard Updates

### Enhanced Dashboard Controller (`src/controllers/dashboardController.ts`)

The dashboard now includes:

1. **Hospital Settings** (currency, locale, timezone)
2. **Branding Information** (colors, logo, name, tagline)
3. **Bed Occupancy Statistics**

**New Response Structure:**
```json
{
  "settings": {
    "currency": "NGN",
    "currencySymbol": "₦",
    "locale": "en-NG",
    "timezone": "Africa/Lagos"
  },
  "branding": {
    "hospitalName": "City General Hospital",
    "primaryColor": "#0D7C66",
    "secondaryColor": "#F5A623",
    "logoUrl": "",
    "tagline": "Quality Healthcare for All"
  },
  "stats": {
    "todayVisits": 8,
    "queueCount": 4,
    "totalPatients": 16,
    "todayRevenue": 15000,  // ₦ Naira
    "todayBilled": 23500,
    "outstandingAmount": 8500,
    "outstandingBillsCount": 1,
    "pendingPrescriptions": 1,
    "pendingLabOrders": 3,
    "lowStockCount": 0
  },
  "bedOccupancy": {
    "total": 104,
    "occupied": 1,
    "available": 103,
    "occupancyPercentage": 1
  },
  "breakdowns": { ... },
  "recentActivity": [ ... ]
}
```

---

## 5. Billing Updates (NHIS Support)

### Enhanced Billing Controller (`src/controllers/billingController.ts`)

#### `POST /api/v1/billing` (createBill)
Now accepts optional insurance/NHIS fields:

**Request Body:**
```json
{
  "visitId": "...",
  "patientId": "...",
  "items": [
    {
      "description": "Consultation Fee",
      "category": "CONSULTATION",
      "amount": 5000,
      "quantity": 1
    }
  ],
  "insuranceProvider": "HydiaHMO",           // Optional
  "insurancePolicyNumber": "HYD/12345/2024", // Optional
  "insuranceCoverage": 70                     // Optional (percentage)
}
```

**Usage Example:**
- Patient has 70% HMO coverage
- Bill total: ₦10,000
- Insurance covers: ₦7,000 (70%)
- Patient pays: ₦3,000 (30%)

The system stores the insurance info but doesn't automatically calculate covered amounts (this is for display/record-keeping purposes).

---

## 6. Seed Script Updates

### Nigerian Hospital Data (`src/seed.ts`)

The seed script now creates:

1. **Hospital:** City General Hospital, Lagos
   - Address: 45 Awolowo Road, Ikoyi, Lagos State
   - Full Nigerian settings structure
   - Nigerian departments

2. **Patients:** Nigerian names and addresses
   - Chinedu Okafor (Lagos)
   - Amina Bello (Victoria Island)
   - Oluwaseun Adeyemi (Ikeja)
   - Fatima Ibrahim (Kaduna)
   - Emeka Nwosu (Port Harcourt)
   - Blessing Eze (Onitsha)
   - Taiwo Ogunleye (Ikeja)
   - Ngozi Chukwu (Enugu)

3. **Billing:** Amounts in Naira (₦)
   - Consultation: ₦5,000
   - Lab tests: ₦2,000-3,500
   - Medications: ₦1,500-6,500

---

## 7. Route Registration

New route added to `src/routes/index.ts`:
```typescript
router.use('/settings', settingsRoutes);
```

**Full endpoints:**
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/settings/departments`
- `PUT /api/v1/settings/branding`

---

## 8. Testing

### TypeScript Compilation
✅ Passed: `npx tsc --noEmit` with no errors

### Database Migration
✅ Applied: `npx prisma db push --accept-data-loss`

### Seed Script
✅ Successfully populated database with Nigerian hospital data

---

## 9. Usage Examples

### Frontend Integration

#### Display Currency
```typescript
const { settings } = dashboardData;
const formatCurrency = (amount: number) => 
  `${settings.currencySymbol}${amount.toLocaleString(settings.locale)}`;

// Usage: formatCurrency(5000) => "₦5,000"
```

#### Apply Branding
```typescript
const { branding } = dashboardData;

// Set theme colors
document.documentElement.style.setProperty('--primary-color', branding.primaryColor);
document.documentElement.style.setProperty('--secondary-color', branding.secondaryColor);

// Display hospital name
<h1>{branding.hospitalName}</h1>
<p>{branding.tagline}</p>
```

#### Create Bill with NHIS
```typescript
const createBillWithInsurance = async (visitId, patientId, items, insurance) => {
  const response = await fetch('/api/v1/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      visitId,
      patientId,
      items,
      insuranceProvider: insurance.provider,      // "HydiaHMO"
      insurancePolicyNumber: insurance.policyNo,  // "HYD/12345/2024"
      insuranceCoverage: insurance.coverage       // 70
    })
  });
  return response.json();
};
```

#### Department Selector
```typescript
const { data: departments } = await fetch('/api/v1/settings/departments', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Render dropdown
<select>
  {departments.departments.map(dept => (
    <option value={dept}>{dept}</option>
  ))}
</select>
```

---

## 10. Future Enhancements

Potential additions for Nigerian healthcare context:

1. **NHIS Claim Management**
   - Submit claims to HMOs
   - Track approval status
   - Automated co-payment calculation

2. **State-specific Regulations**
   - Lagos State regulations
   - FCT-specific requirements

3. **NHIA Provider Integration**
   - Verification of policy numbers
   - Real-time eligibility checks

4. **Nigerian Payment Gateways**
   - Paystack integration
   - Flutterwave integration
   - Direct bank transfer via NIBSS

5. **Local Medical Standards**
   - Nigerian formulary
   - Standard treatment protocols
   - MDCN guidelines integration

---

## 11. Migration Guide (For Existing Installations)

If you have an existing database:

1. **Backup your database**
   ```bash
   cp dev.db dev.db.backup
   ```

2. **Run migration**
   ```bash
   npx prisma db push
   ```

3. **Update hospital settings** (via API or directly):
   ```typescript
   await prisma.hospital.update({
     where: { id: yourHospitalId },
     data: {
       settings: { /* paste Nigerian settings structure */ }
     }
   });
   ```

4. **Update existing bills** (optional, for insurance):
   ```sql
   -- Add insurance info to existing bills if needed
   UPDATE BillingRecord 
   SET insuranceProvider = 'NHIS', 
       insuranceCoverage = 70 
   WHERE patientId IN (SELECT id FROM Patient WHERE ...);
   ```

---

## 12. Configuration Variables

No new environment variables required. All configuration is stored in the database via `Hospital.settings`.

---

## Contact & Support

For questions about Nigerian healthcare customizations:
- Check the API documentation: `/api/v1/settings`
- Review seed script: `src/seed.ts`
- Examine controller: `src/controllers/settingsController.ts`

---

**Implementation Date:** February 2, 2026  
**Version:** 1.0.0  
**Status:** ✅ Complete & Tested
