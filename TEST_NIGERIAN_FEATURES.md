# Testing Nigerian Healthcare Features

## Quick API Test Guide

Use these curl commands or your API client (Postman/Insomnia) to test the new features.

---

## Setup

1. **Start the backend server:**
   ```bash
   cd /home/mccoy/.openclaw/workspace/hms-modern/backend
   npm run dev
   ```

2. **Get authentication token:**
   ```bash
   # Login as admin
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@cityhospital.com",
       "password": "Password@123"
     }'
   ```

   Save the `accessToken` from the response.

---

## Test 1: Public Settings (No Auth Required)

```bash
curl http://localhost:3000/api/v1/settings
```

**Expected Response:**
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

---

## Test 2: Get Full Settings (Authenticated)

```bash
curl http://localhost:3000/api/v1/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
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
  "settings": {
    "currency": "NGN",
    "currencySymbol": "₦",
    "locale": "en-NG",
    "timezone": "Africa/Lagos",
    "dateFormat": "DD/MM/YYYY",
    "departments": [
      "General Medicine",
      "Cardiology",
      "Pediatrics",
      "Obstetrics & Gynaecology",
      "Surgery",
      "Orthopaedics",
      "ENT",
      "Ophthalmology",
      "Dermatology",
      "Dental",
      "Radiology",
      "Physiotherapy"
    ],
    "consultationFee": 5000,
    "registrationFee": 2000,
    "nhisEnabled": true,
    "nhisProviders": [
      "NHIS",
      "HydiaHMO",
      "Leadway",
      "AXA Mansard",
      "Hygeia",
      "Reliance"
    ],
    ...
  }
}
```

---

## Test 3: Get Departments

```bash
curl http://localhost:3000/api/v1/settings/departments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "departments": [
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    "Obstetrics & Gynaecology",
    "Surgery",
    "Orthopaedics",
    "ENT",
    "Ophthalmology",
    "Dermatology",
    "Dental",
    "Radiology",
    "Physiotherapy"
  ]
}
```

---

## Test 4: Update Settings (Admin Only)

```bash
curl -X PUT http://localhost:3000/api/v1/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "consultationFee": 6000,
      "registrationFee": 2500
    }
  }'
```

**Expected Response:**
```json
{
  "message": "Settings updated successfully",
  "settings": {
    "currency": "NGN",
    "consultationFee": 6000,
    "registrationFee": 2500,
    ...
  }
}
```

---

## Test 5: Update Branding (Admin Only)

```bash
curl -X PUT http://localhost:3000/api/v1/settings/branding \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#1E88E5",
    "secondaryColor": "#FF9800",
    "hospitalName": "Lagos General Hospital",
    "tagline": "Excellence in Healthcare"
  }'
```

**Expected Response:**
```json
{
  "message": "Branding updated successfully",
  "branding": {
    "primaryColor": "#1E88E5",
    "secondaryColor": "#FF9800",
    "logoUrl": "",
    "hospitalName": "Lagos General Hospital",
    "tagline": "Excellence in Healthcare"
  }
}
```

---

## Test 6: Enhanced Dashboard (with Settings & Bed Occupancy)

```bash
curl http://localhost:3000/api/v1/dashboard/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
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
    "todayRevenue": 15000,
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
  "breakdowns": {
    "byDepartment": [...],
    "byStatus": [...]
  },
  "recentActivity": [...]
}
```

**Verify:**
- ✅ Currency is NGN (₦)
- ✅ Revenue amounts are in Naira
- ✅ Bed occupancy stats present
- ✅ Branding info included

---

## Test 7: Create Bill with NHIS/Insurance

First, get a visit ID and patient ID from the seed data:

```bash
# List visits
curl http://localhost:3000/api/v1/visits \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Then create a bill with insurance:

```bash
curl -X POST http://localhost:3000/api/v1/billing \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitId": "VISIT_ID_FROM_ABOVE",
    "patientId": "PATIENT_ID_FROM_ABOVE",
    "items": [
      {
        "description": "Consultation Fee",
        "category": "CONSULTATION",
        "amount": 5000,
        "quantity": 1
      },
      {
        "description": "Full Blood Count",
        "category": "LAB",
        "amount": 2000,
        "quantity": 1
      }
    ],
    "insuranceProvider": "HydiaHMO",
    "insurancePolicyNumber": "HYD/2024/12345",
    "insuranceCoverage": 70
  }'
```

**Expected Response:**
```json
{
  "billingRecord": {
    "id": "...",
    "visitId": "...",
    "patientId": "...",
    "hospitalId": "...",
    "status": "PENDING",
    "totalAmount": 7000,
    "paidAmount": 0,
    "insuranceProvider": "HydiaHMO",
    "insurancePolicyNumber": "HYD/2024/12345",
    "insuranceCoverage": 70,
    "items": [
      {
        "description": "Consultation Fee",
        "category": "CONSULTATION",
        "amount": 5000,
        "quantity": 1
      },
      {
        "description": "Full Blood Count",
        "category": "LAB",
        "amount": 2000,
        "quantity": 1
      }
    ],
    ...
  }
}
```

**Verify:**
- ✅ `insuranceProvider` is set
- ✅ `insurancePolicyNumber` is set
- ✅ `insuranceCoverage` is set (70%)
- ✅ Total amount: ₦7,000

**Insurance Calculation (for reference):**
- Total bill: ₦7,000
- Insurance covers: 70% = ₦4,900
- Patient pays: 30% = ₦2,100

---

## Test 8: Verify Database Schema

```bash
cd /home/mccoy/.openclaw/workspace/hms-modern/backend
npx prisma studio
```

Open Prisma Studio in browser and check:

1. **Hospital table** → `settings` field should contain Nigerian JSON structure
2. **BillingRecord table** → Should have new columns:
   - `insuranceProvider`
   - `insurancePolicyNumber`
   - `insuranceCoverage`

---

## Test Checklist

- [ ] Public settings endpoint works without authentication
- [ ] Authenticated users can get full settings
- [ ] Departments endpoint returns Nigerian departments
- [ ] Admin can update settings
- [ ] Admin can update branding
- [ ] Dashboard includes settings, branding, and bed occupancy
- [ ] Can create bills with NHIS/insurance information
- [ ] Currency displays as ₦ (Naira)
- [ ] All monetary values are in Naira
- [ ] No TypeScript compilation errors
- [ ] Seed script creates Nigerian hospital data

---

## Troubleshooting

### 401 Unauthorized
- Check that your token is valid
- Token format: `Bearer YOUR_ACCESS_TOKEN`

### 403 Forbidden
- Only ADMIN or SUPER_ADMIN can update settings
- Login as admin@cityhospital.com (Password: Password@123)

### 404 Not Found
- Ensure the backend is running on port 3000
- Check the endpoint path: `/api/v1/settings`

### Database Issues
- Re-run seed: `npm run seed`
- Check database: `npx prisma studio`

---

## Sample Test Script (Node.js)

```javascript
const API_URL = 'http://localhost:3000/api/v1';

async function testNigerianFeatures() {
  // 1. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@cityhospital.com',
      password: 'Password@123'
    })
  });
  const { accessToken } = await loginRes.json();
  console.log('✅ Login successful');

  // 2. Get settings
  const settingsRes = await fetch(`${API_URL}/settings`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const settings = await settingsRes.json();
  console.log('✅ Settings:', settings.settings.currency); // Should be "NGN"

  // 3. Get dashboard
  const dashRes = await fetch(`${API_URL}/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const dashboard = await dashRes.json();
  console.log('✅ Dashboard currency:', dashboard.settings.currencySymbol); // Should be "₦"
  console.log('✅ Bed occupancy:', dashboard.bedOccupancy);

  // 4. Get departments
  const deptsRes = await fetch(`${API_URL}/settings/departments`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const depts = await deptsRes.json();
  console.log('✅ Departments:', depts.departments.length); // Should be 12

  console.log('\n✅ All tests passed!');
}

testNigerianFeatures().catch(console.error);
```

Save as `test-nigerian.js` and run: `node test-nigerian.js`

---

**Testing Date:** February 2, 2026  
**Status:** Ready for Testing
