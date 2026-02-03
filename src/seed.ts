import { hashPassword } from './utils/password';
import { prisma } from './db';
import 'dotenv/config';

const seed = async () => {
  try {
    console.log('🌱 Seeding database...\n');

    // Create SuperAdmin
    const superAdminPassword = await hashPassword('Admin@123');
    await prisma.user.upsert({
      where: { email: 'admin@hms.com' },
      update: {},
      create: {
        email: 'admin@hms.com',
        password: superAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+1234567890',
        role: 'SUPER_ADMIN',
        active: true,
      },
    });
    console.log('✅ SuperAdmin created:');
    console.log('   Email: admin@hms.com');
    console.log('   Password: Admin@123\n');

    // Create a sample hospital with Nigerian settings
    const hospital = await prisma.hospital.upsert({
      where: { email: 'contact@cityhospital.com' },
      update: {},
      create: {
        name: 'City General Hospital',
        address: '45 Awolowo Road, Ikoyi, Lagos State',
        phone: '+234 803 456 7890',
        email: 'contact@cityhospital.com',
        active: true,
        settings: {
          currency: 'NGN',
          currencySymbol: '₦',
          locale: 'en-NG',
          timezone: 'Africa/Lagos',
          dateFormat: 'DD/MM/YYYY',
          departments: [
            'General Medicine',
            'Cardiology',
            'Pediatrics',
            'Obstetrics & Gynaecology',
            'Surgery',
            'Orthopaedics',
            'ENT',
            'Ophthalmology',
            'Dermatology',
            'Dental',
            'Radiology',
            'Physiotherapy',
          ],
          consultationFee: 5000,
          registrationFee: 2000,
          nhisEnabled: true,
          nhisProviders: ['NHIS', 'HydiaHMO', 'Leadway', 'AXA Mansard', 'Hygeia', 'Reliance'],
          taxId: '',
          rcNumber: '',
          address: {
            street: '45 Awolowo Road',
            city: 'Lagos',
            state: 'Lagos State',
            country: 'Nigeria',
          },
          branding: {
            primaryColor: '#0D7C66',
            secondaryColor: '#F5A623',
            logoUrl: '',
            hospitalName: 'City General Hospital',
            tagline: 'Quality Healthcare for All',
          },
          features: {
            pharmacy: true,
            lab: true,
            billing: true,
            ipd: true,
            nursing: true,
            appointments: false,
            telemedicine: false,
          },
          paymentMethods: ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY'],
          mobileMoneyProviders: ['OPay', 'PalmPay', 'Paga', 'Kuda'],
        },
      },
    });
    console.log('✅ Hospital created:');
    console.log(`   Name: ${hospital.name}`);
    console.log(`   Address: 45 Awolowo Road, Ikoyi, Lagos`);
    console.log(`   ID: ${hospital.id}\n`);

    // Create MediSeen demo users (for frontend demo)
    const demoPassword = await hashPassword('password123');
    const demoUsers = [
      { email: 'reception@mediseen.com', firstName: 'Chidinma', lastName: 'Onyeka', role: 'RECEPTIONIST', department: 'Reception' },
      { email: 'nurse@mediseen.com', firstName: 'Fatima', lastName: 'Ibrahim', role: 'NURSE', department: 'General Ward' },
      { email: 'doctor@mediseen.com', firstName: 'Adewale', lastName: 'Ogundimu', role: 'DOCTOR', department: 'General Medicine' },
      { email: 'pharmacy@mediseen.com', firstName: 'Oluwaseun', lastName: 'Adeleke', role: 'PHARMACIST', department: 'Pharmacy' },
      { email: 'lab@mediseen.com', firstName: 'Tunde', lastName: 'Bakare', role: 'LAB_TECH', department: 'Laboratory' },
      { email: 'billing@mediseen.com', firstName: 'Emmanuel', lastName: 'Obi', role: 'BILLING_OFFICER', department: 'Billing' },
      { email: 'admin@mediseen.com', firstName: 'Oluwaseun', lastName: 'Adeyemi', role: 'ADMIN', department: 'Administration' },
      { email: 'superadmin@mediseen.com', firstName: 'Ibrahim', lastName: 'Yusuf', role: 'SUPER_ADMIN', department: 'Administration' },
    ];

    console.log('✅ MediSeen demo users created:\n');
    for (const demoUser of demoUsers) {
      const user = await prisma.user.upsert({
        where: { email: demoUser.email },
        update: {},
        create: {
          email: demoUser.email,
          password: demoPassword,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          phone: `+234803456${Math.floor(Math.random() * 10000)}`,
          role: demoUser.role as any,
          hospitalId: hospital.id,
          department: demoUser.department,
          active: true,
        },
      });
      console.log(`   ${demoUser.role}: ${user.email} / password123`);
    }
    console.log('');

    // Create users for each role
    const roles = [
      { role: 'ADMIN', firstName: 'Admin', lastName: 'User', email: 'admin@cityhospital.com', department: 'Administration' },
      { role: 'DOCTOR', firstName: 'Dr. John', lastName: 'Smith', email: 'doctor@cityhospital.com', department: 'General Medicine' },
      { role: 'NURSE', firstName: 'Jane', lastName: 'Doe', email: 'nurse@cityhospital.com', department: 'General Ward' },
      { role: 'PHARMACIST', firstName: 'Mike', lastName: 'Johnson', email: 'pharmacist@cityhospital.com', department: 'Pharmacy' },
      { role: 'LAB_TECH', firstName: 'Sarah', lastName: 'Williams', email: 'labtech@cityhospital.com', department: 'Laboratory' },
      { role: 'RECEPTIONIST', firstName: 'Emily', lastName: 'Brown', email: 'receptionist@cityhospital.com', department: 'Front Desk' },
      { role: 'BILLING_OFFICER', firstName: 'David', lastName: 'Lee', email: 'billing@cityhospital.com', department: 'Billing' },
      { role: 'WARD_MANAGER', firstName: 'Maria', lastName: 'Garcia', email: 'wardmanager@cityhospital.com', department: 'Ward Management' },
    ];

    console.log('✅ Staff users created:\n');
    for (const roleData of roles) {
      const password = await hashPassword('Password@123');
      const user = await prisma.user.upsert({
        where: { email: roleData.email },
        update: {},
        create: {
          email: roleData.email,
          password,
          firstName: roleData.firstName,
          lastName: roleData.lastName,
          phone: `+123456789${Math.floor(Math.random() * 10)}`,
          role: roleData.role as any,
          hospitalId: hospital.id,
          department: roleData.department,
          active: true,
        },
      });
      console.log(`   ${roleData.role}:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: Password@123\n`);
    }

    // Create sample inventory items
    const inventoryItems = [
      {
        name: 'Paracetamol 500mg',
        category: 'Medication',
        stock: 1000,
        reorderLevel: 200,
        unitPrice: 0.5,
        supplier: 'PharmaCorp',
      },
      {
        name: 'Amoxicillin 250mg',
        category: 'Medication',
        stock: 500,
        reorderLevel: 100,
        unitPrice: 1.2,
        supplier: 'PharmaCorp',
      },
      {
        name: 'Surgical Gloves (Box)',
        category: 'Supplies',
        stock: 50,
        reorderLevel: 20,
        unitPrice: 12.5,
        supplier: 'MedSupply Inc',
      },
      {
        name: 'Syringes 5ml (Pack of 100)',
        category: 'Supplies',
        stock: 30,
        reorderLevel: 10,
        unitPrice: 8.0,
        supplier: 'MedSupply Inc',
      },
      {
        name: 'Bandages (Roll)',
        category: 'Supplies',
        stock: 100,
        reorderLevel: 30,
        unitPrice: 2.5,
        supplier: 'MedSupply Inc',
      },
    ];

    console.log('✅ Inventory items created:\n');
    for (const itemData of inventoryItems) {
      const item = await prisma.inventoryItem.upsert({
        where: { 
          id: `${hospital.id}-${itemData.name}` // Composite unique constraint workaround
        },
        update: {},
        create: {
          ...itemData,
          hospitalId: hospital.id,
        },
      }).catch(() => 
        // If unique constraint fails, just create without upsert
        prisma.inventoryItem.create({
          data: {
            ...itemData,
            hospitalId: hospital.id,
          },
        })
      );
      console.log(`   ${item.name} - Stock: ${item.stock}, Price: $${item.unitPrice}`);
    }

    // Create wards, rooms, and beds
    console.log('\n✅ Creating wards, rooms, and beds:\n');

    const wardsData = [
      { name: 'General Ward - Male', type: 'GENERAL' as const, floor: '2', capacity: 20 },
      { name: 'General Ward - Female', type: 'GENERAL' as const, floor: '2', capacity: 20 },
      { name: 'ICU', type: 'ICU' as const, floor: '3', capacity: 10 },
      { name: 'Pediatric Ward', type: 'PEDIATRIC' as const, floor: '1', capacity: 15 },
      { name: 'Private Wing', type: 'PRIVATE' as const, floor: '4', capacity: 8 },
    ];

    for (const wardData of wardsData) {
      const ward = await prisma.ward.create({
        data: {
          ...wardData,
          hospitalId: hospital.id,
        },
      });

      console.log(`   Ward created: ${ward.name} (${ward.type})`);

      // Create rooms for each ward
      const roomsPerWard = wardData.type === 'ICU' ? 2 : wardData.type === 'PRIVATE' ? 4 : 4;
      for (let roomNum = 1; roomNum <= roomsPerWard; roomNum++) {
        const roomType: 'ICU' | 'SINGLE' | 'DOUBLE' | 'MULTI' = 
          wardData.type === 'ICU' ? 'ICU' : 
          wardData.type === 'PRIVATE' ? 'SINGLE' : 
          roomNum <= 2 ? 'MULTI' : 'DOUBLE';
        const roomCapacity = roomType === 'SINGLE' ? 1 : roomType === 'DOUBLE' ? 2 : wardData.type === 'ICU' ? 3 : 5;

        const room = await prisma.room.create({
          data: {
            wardId: ward.id,
            roomNumber: `${ward.name.substring(0, 3).toUpperCase()}-${roomNum.toString().padStart(2, '0')}`,
            type: roomType,
            capacity: roomCapacity,
          },
        });

        // Create beds for each room
        for (let bedNum = 1; bedNum <= roomCapacity; bedNum++) {
          await prisma.bed.create({
            data: {
              roomId: room.id,
              bedNumber: `${room.roomNumber}-B${bedNum}`,
              status: 'AVAILABLE',
            },
          });
        }
      }
    }

    // Count total beds created
    const totalBeds = await prisma.bed.count({ where: { room: { ward: { hospitalId: hospital.id } } } });
    console.log(`   Total beds created: ${totalBeds}\n`);

    // Get staff users for references
    const doctor = await prisma.user.findUnique({ where: { email: 'doctor@cityhospital.com' } });
    const nurse = await prisma.user.findUnique({ where: { email: 'nurse@cityhospital.com' } });
    const receptionist = await prisma.user.findUnique({ where: { email: 'receptionist@cityhospital.com' } });
    const wardManager = await prisma.user.findUnique({ where: { email: 'wardmanager@cityhospital.com' } });
    const billingOfficer = await prisma.user.findUnique({ where: { email: 'billing@cityhospital.com' } });

    if (!doctor || !nurse || !receptionist || !wardManager || !billingOfficer) {
      throw new Error('Staff users not found');
    }

    // Create sample patients
    console.log('✅ Creating sample patients:\n');
    const patientsData = [
      { firstName: 'Chinedu', lastName: 'Okafor', dateOfBirth: new Date('1985-03-15'), gender: 'Male', phone: '+2348012345001', bloodGroup: 'O+', allergies: ['Penicillin'], currentMedications: ['Metformin'], address: '45 Awolowo Road, Ikoyi, Lagos' },
      { firstName: 'Amina', lastName: 'Bello', dateOfBirth: new Date('1992-07-22'), gender: 'Female', phone: '+2348012345002', bloodGroup: 'A+', allergies: [], currentMedications: [], address: '12 Adetokunbo Ademola Street, Victoria Island' },
      { firstName: 'Oluwaseun', lastName: 'Adeyemi', dateOfBirth: new Date('1978-11-08'), gender: 'Male', phone: '+2348012345003', bloodGroup: 'B+', allergies: ['Sulfa drugs'], currentMedications: ['Lisinopril', 'Amlodipine'], address: '8 Allen Avenue, Ikeja, Lagos' },
      { firstName: 'Fatima', lastName: 'Ibrahim', dateOfBirth: new Date('2001-01-30'), gender: 'Female', phone: '+2348012345004', bloodGroup: 'AB+', allergies: [], currentMedications: [], address: '33 Ahmadu Bello Way, Kaduna' },
      { firstName: 'Emeka', lastName: 'Nwosu', dateOfBirth: new Date('1965-05-12'), gender: 'Male', phone: '+2348012345005', bloodGroup: 'O-', allergies: ['Aspirin', 'Ibuprofen'], currentMedications: ['Warfarin', 'Atorvastatin', 'Metoprolol'], address: '7 Trans Amadi Road, Port Harcourt' },
      { firstName: 'Blessing', lastName: 'Eze', dateOfBirth: new Date('1988-09-25'), gender: 'Female', phone: '+2348012345006', bloodGroup: 'A-', allergies: [], currentMedications: [], address: '21 New Market Road, Onitsha' },
      { firstName: 'Taiwo', lastName: 'Ogunleye', dateOfBirth: new Date('2015-12-03'), gender: 'Male', phone: '+2348012345007', bloodGroup: 'B-', allergies: ['Peanuts'], currentMedications: [], emergencyContactName: 'Kehinde Ogunleye', emergencyContactPhone: '+2348012345008', emergencyContactRelationship: 'Mother', address: '15 Opebi Road, Ikeja, Lagos' },
      { firstName: 'Ngozi', lastName: 'Chukwu', dateOfBirth: new Date('1955-04-18'), gender: 'Female', phone: '+2348012345009', bloodGroup: 'O+', allergies: [], currentMedications: ['Insulin', 'Metformin', 'Losartan'], address: '3 Ogui Road, Enugu' },
    ];

    const patients = [];
    for (const pd of patientsData) {
      const patient = await prisma.patient.create({
        data: {
          ...pd,
          hospitalId: hospital.id,
          createdBy: receptionist.id,
          allergies: pd.allergies,
          currentMedications: pd.currentMedications,
        },
      });
      patients.push(patient);
      console.log(`   ${patient.firstName} ${patient.lastName} (${patient.gender}, ${patient.bloodGroup})`);
    }

    // Create visits with different statuses
    console.log('\n✅ Creating sample visits:\n');
    const now = new Date();
    const visitsData = [
      { patientIdx: 0, department: 'General Medicine', status: 'IN_PROGRESS' as const, reason: 'Persistent headache and dizziness for 3 days', hoursAgo: 2 },
      { patientIdx: 1, department: 'General Medicine', status: 'WAITING' as const, reason: 'Follow-up for recurring stomach pain', hoursAgo: 1 },
      { patientIdx: 2, department: 'Cardiology', status: 'CHECKED_IN' as const, reason: 'Chest pain and shortness of breath', hoursAgo: 0.5 },
      { patientIdx: 3, department: 'General Medicine', status: 'WAITING' as const, reason: 'High fever and body aches', hoursAgo: 1.5 },
      { patientIdx: 4, department: 'Cardiology', status: 'IN_PROGRESS' as const, reason: 'Routine cardiac check-up, abnormal ECG', hoursAgo: 3 },
      { patientIdx: 5, department: 'Obstetrics', status: 'CHECKED_IN' as const, reason: 'Prenatal check-up, 28 weeks', hoursAgo: 0.25 },
      { patientIdx: 6, department: 'Pediatrics', status: 'WAITING' as const, reason: 'Persistent cough and mild fever', hoursAgo: 1 },
      { patientIdx: 7, department: 'General Medicine', status: 'COMPLETED' as const, reason: 'Diabetic follow-up and medication review', hoursAgo: 5 },
    ];

    const visits = [];
    for (const vd of visitsData) {
      const checkIn = new Date(now.getTime() - vd.hoursAgo * 60 * 60 * 1000);
      const visit = await prisma.visit.create({
        data: {
          hospitalId: hospital.id,
          patientId: patients[vd.patientIdx].id,
          department: vd.department,
          status: vd.status,
          reasonForVisit: vd.reason,
          checkInTime: checkIn,
          assignedTo: vd.status === 'IN_PROGRESS' ? doctor.id : undefined,
          completedTime: vd.status === 'COMPLETED' ? new Date(checkIn.getTime() + 2 * 60 * 60 * 1000) : undefined,
          createdBy: receptionist.id,
        },
      });
      visits.push(visit);
      console.log(`   ${patients[vd.patientIdx].firstName} ${patients[vd.patientIdx].lastName} - ${vd.status} (${vd.department})`);
    }

    // Create vital signs (triage data)
    console.log('\n✅ Creating vital signs / triage records:\n');
    const vitalsData = [
      { visitIdx: 0, patientIdx: 0, bp: '140/90', hr: 88, temp: 37.2, weight: 82, height: 175, rr: 18, spo2: 97, bs: 6.5, pain: 5, triage: 'STANDARD' as const, notes: 'Slightly elevated BP, mild headache' },
      { visitIdx: 1, patientIdx: 1, bp: '120/80', hr: 72, temp: 36.8, weight: 65, height: 163, rr: 16, spo2: 99, bs: 5.2, pain: 3, triage: 'NON_URGENT' as const, notes: 'Stable vitals, follow-up visit' },
      { visitIdx: 2, patientIdx: 2, bp: '165/100', hr: 105, temp: 37.0, weight: 90, height: 180, rr: 22, spo2: 94, bs: 7.8, pain: 7, triage: 'EMERGENCY' as const, notes: 'HIGH BP, tachycardic, chest pain - URGENT cardiology review needed' },
      { visitIdx: 3, patientIdx: 3, bp: '110/70', hr: 95, temp: 39.2, weight: 58, height: 165, rr: 20, spo2: 97, bs: 5.0, pain: 4, triage: 'URGENT' as const, notes: 'High fever 39.2°C, possible infection' },
      { visitIdx: 4, patientIdx: 4, bp: '150/95', hr: 78, temp: 36.9, weight: 95, height: 172, rr: 17, spo2: 96, bs: 8.2, pain: 2, triage: 'STANDARD' as const, notes: 'Known cardiac patient, elevated BP and blood sugar' },
      { visitIdx: 5, patientIdx: 5, bp: '115/75', hr: 80, temp: 36.6, weight: 72, height: 160, rr: 16, spo2: 99, bs: 4.8, pain: 1, triage: 'NON_URGENT' as const, notes: 'Normal vitals, routine prenatal' },
      { visitIdx: 6, patientIdx: 6, bp: '95/60', hr: 110, temp: 38.5, weight: 25, height: 110, rr: 24, spo2: 96, bs: 5.5, pain: 3, triage: 'URGENT' as const, notes: 'Pediatric - fever, elevated HR for age' },
    ];

    const vitalRecords = [];
    for (const vt of vitalsData) {
      const vitals = await prisma.vitalSigns.create({
        data: {
          visitId: visits[vt.visitIdx].id,
          patientId: patients[vt.patientIdx].id,
          hospitalId: hospital.id,
          recordedBy: nurse.id,
          bloodPressure: vt.bp,
          heartRate: vt.hr,
          temperature: vt.temp,
          weight: vt.weight,
          height: vt.height,
          respiratoryRate: vt.rr,
          oxygenSaturation: vt.spo2,
          bloodSugar: vt.bs,
          painLevel: vt.pain,
          notes: vt.notes,
          triageCategory: vt.triage,
        },
      });
      vitalRecords.push(vitals);
      console.log(`   ${patients[vt.patientIdx].firstName} - BP:${vt.bp} HR:${vt.hr} Temp:${vt.temp}°C [${vt.triage}]`);
    }

    // Create consultations for in-progress/completed visits
    console.log('\n✅ Creating consultations:\n');
    const consultationsData = [
      { visitIdx: 0, patientIdx: 0, complaint: 'Persistent headache and dizziness', diagnosis: 'Tension headache with mild hypertension', treatment: 'Paracetamol 1g TDS, BP monitoring, reduce salt intake', followUp: '1 week' },
      { visitIdx: 4, patientIdx: 4, complaint: 'Routine cardiac check-up, ECG abnormality', diagnosis: 'Atrial fibrillation, uncontrolled hypertension', treatment: 'Adjusted Warfarin dose, added Digoxin 0.25mg daily', followUp: '3 days - admit for observation' },
      { visitIdx: 7, patientIdx: 7, complaint: 'Diabetic follow-up', diagnosis: 'Type 2 DM, poorly controlled. HbA1c 8.2%', treatment: 'Increased Metformin to 1g BD, continue Insulin Glargine 20 units', followUp: '2 weeks' },
    ];

    for (const cd of consultationsData) {
      await prisma.consultation.create({
        data: {
          visitId: visits[cd.visitIdx].id,
          patientId: patients[cd.patientIdx].id,
          doctorId: doctor.id,
          chiefComplaint: cd.complaint,
          diagnosis: cd.diagnosis,
          treatmentPlan: cd.treatment,
          followUp: cd.followUp,
        },
      });
      console.log(`   ${patients[cd.patientIdx].firstName} - ${cd.diagnosis.substring(0, 50)}...`);
    }

    // Create admissions (2 patients admitted)
    console.log('\n✅ Creating admissions:\n');

    // Get some beds
    const availableBeds = await prisma.bed.findMany({
      where: { status: 'AVAILABLE' },
      include: { room: { include: { ward: true } } },
      take: 3,
    });

    // Admit patient 4 (Emeka - cardiac) 
    const admission1 = await prisma.admission.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[4].id,
        visitId: visits[4].id,
        status: 'ADMITTED',
        admittedBy: doctor.id,
        wardId: availableBeds[0].room.ward.id,
        roomId: availableBeds[0].room.id,
        bedId: availableBeds[0].id,
        assignedWardManager: wardManager.id,
        diagnosis: 'Atrial fibrillation with uncontrolled hypertension - observation required',
        admissionNotes: 'Patient needs cardiac monitoring. Adjust medications and observe for 48-72 hours.',
      },
    });
    await prisma.bed.update({
      where: { id: availableBeds[0].id },
      data: { status: 'OCCUPIED', currentPatientId: patients[4].id, currentAdmissionId: admission1.id },
    });
    console.log(`   ${patients[4].firstName} ${patients[4].lastName} → ${availableBeds[0].room.ward.name}, Bed ${availableBeds[0].bedNumber} [ADMITTED]`);

    // Admit patient 2 (Oluwaseun - chest pain) - pending bed assignment
    await prisma.admission.create({
      data: {
        hospitalId: hospital.id,
        patientId: patients[2].id,
        visitId: visits[2].id,
        status: 'PENDING',
        admittedBy: doctor.id,
        diagnosis: 'Severe chest pain with hypertensive crisis - needs ICU monitoring',
        admissionNotes: 'Urgent admission. Start IV antihypertensives. Continuous cardiac monitoring required.',
      },
    });
    console.log(`   ${patients[2].firstName} ${patients[2].lastName} → PENDING bed assignment [PENDING]`);

    // Create nursing rounds for admitted patient
    console.log('\n✅ Creating nursing rounds:\n');
    const roundsData = [
      { hoursAgo: 6, type: 'ROUTINE' as const, condition: 'STABLE' as const, obs: 'Patient resting comfortably. Oriented x3. No complaints of chest pain.', meds: [{ name: 'Warfarin 5mg', time: '08:00', route: 'Oral' }, { name: 'Metoprolol 50mg', time: '08:00', route: 'Oral' }] },
      { hoursAgo: 2, type: 'MEDICATION' as const, condition: 'IMPROVING' as const, obs: 'BP improving. Patient reports feeling better. Ate lunch well.', meds: [{ name: 'Atorvastatin 20mg', time: '14:00', route: 'Oral' }] },
    ];

    for (const rd of roundsData) {
      const roundVitals = await prisma.vitalSigns.create({
        data: {
          patientId: patients[4].id,
          hospitalId: hospital.id,
          recordedBy: nurse.id,
          bloodPressure: rd.hoursAgo === 6 ? '145/92' : '135/85',
          heartRate: rd.hoursAgo === 6 ? 82 : 76,
          temperature: 36.8,
          respiratoryRate: 16,
          oxygenSaturation: 97,
          painLevel: rd.hoursAgo === 6 ? 2 : 1,
        },
      });

      await prisma.nursingRound.create({
        data: {
          admissionId: admission1.id,
          patientId: patients[4].id,
          performedBy: nurse.id,
          roundType: rd.type,
          vitalSignsId: roundVitals.id,
          medicationGiven: rd.meds,
          observations: rd.obs,
          patientCondition: rd.condition,
          nextRoundDue: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        },
      });
      console.log(`   Round (${rd.type}): ${patients[4].firstName} - ${rd.condition}`);
    }

    // Create doctor review
    console.log('\n✅ Creating doctor reviews:\n');
    await prisma.doctorReview.create({
      data: {
        admissionId: admission1.id,
        patientId: patients[4].id,
        reviewedBy: doctor.id,
        findings: 'BP trending down. AF rate controlled on current medications. No further chest pain episodes.',
        treatmentPlanUpdate: 'Continue current medications. Add Digoxin 0.125mg daily. Recheck ECG tomorrow morning.',
        ordersGiven: [
          { type: 'lab', description: 'FBC, U&E, INR - tomorrow AM' },
          { type: 'investigation', description: 'Repeat ECG at 08:00' },
          { type: 'medication', description: 'Add Digoxin 0.125mg OD' },
        ],
        dischargeRecommendation: false,
        nextReviewDue: new Date(now.getTime() + 18 * 60 * 60 * 1000),
      },
    });
    console.log(`   Dr. Smith reviewed ${patients[4].firstName} - Continue observation, no discharge yet`);

    // Create prescriptions
    console.log('\n✅ Creating prescriptions:\n');
    await prisma.prescription.create({
      data: {
        visitId: visits[0].id,
        patientId: patients[0].id,
        doctorId: doctor.id,
        status: 'PENDING',
        items: {
          create: [
            { medicationName: 'Paracetamol 500mg', dosage: '1g', frequency: 'Three times daily', duration: '5 days', instructions: 'Take after meals' },
            { medicationName: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '30 days', instructions: 'Take in the morning' },
          ],
        },
      },
    });
    console.log(`   ${patients[0].firstName} - Paracetamol + Amlodipine [PENDING]`);

    // Create lab orders
    console.log('\n✅ Creating lab orders:\n');
    const labOrders = [
      { visitIdx: 0, patientIdx: 0, testType: 'Full Blood Count', status: 'COMPLETED' as const },
      { visitIdx: 2, patientIdx: 2, testType: 'Cardiac Troponin', status: 'PROCESSING' as const },
      { visitIdx: 2, patientIdx: 2, testType: 'ECG', status: 'ORDERED' as const },
      { visitIdx: 4, patientIdx: 4, testType: 'INR / Coagulation', status: 'COMPLETED' as const },
      { visitIdx: 7, patientIdx: 7, testType: 'HbA1c', status: 'COMPLETED' as const },
    ];

    for (const lo of labOrders) {
      await prisma.labOrder.create({
        data: {
          visitId: visits[lo.visitIdx].id,
          patientId: patients[lo.patientIdx].id,
          orderedBy: doctor.id,
          testType: lo.testType,
          status: lo.status,
          sampleId: lo.status !== 'ORDERED' ? `SAM-${Date.now().toString(36).toUpperCase()}` : undefined,
          resultValue: lo.status === 'COMPLETED' ? 'Within normal range' : undefined,
          normalRange: lo.status === 'COMPLETED' ? 'See reference values' : undefined,
          processedBy: lo.status === 'COMPLETED' ? nurse.id : undefined,
          completedAt: lo.status === 'COMPLETED' ? new Date() : undefined,
        },
      });
      console.log(`   ${patients[lo.patientIdx].firstName} - ${lo.testType} [${lo.status}]`);
    }

    // Create billing records
    console.log('\n✅ Creating billing records:\n');
    await prisma.billingRecord.create({
      data: {
        visitId: visits[7].id,
        patientId: patients[7].id,
        hospitalId: hospital.id,
        status: 'PAID',
        totalAmount: 15000,
        paidAmount: 15000,
        createdBy: billingOfficer.id,
        items: {
          create: [
            { description: 'Consultation Fee', category: 'CONSULTATION', amount: 5000, quantity: 1 },
            { description: 'HbA1c Test', category: 'LAB', amount: 3500, quantity: 1 },
            { description: 'Medications (30 days)', category: 'MEDICATION', amount: 6500, quantity: 1 },
          ],
        },
        payments: {
          create: [
            { amount: 15000, method: 'CARD', reference: 'TXN-20260202-001', receivedBy: billingOfficer.id },
          ],
        },
      },
    });
    console.log(`   ${patients[7].firstName} - ₦15,000 [PAID]`);

    await prisma.billingRecord.create({
      data: {
        visitId: visits[0].id,
        patientId: patients[0].id,
        hospitalId: hospital.id,
        status: 'PENDING',
        totalAmount: 8500,
        paidAmount: 0,
        createdBy: billingOfficer.id,
        items: {
          create: [
            { description: 'Consultation Fee', category: 'CONSULTATION', amount: 5000, quantity: 1 },
            { description: 'Full Blood Count', category: 'LAB', amount: 2000, quantity: 1 },
            { description: 'Medications', category: 'MEDICATION', amount: 1500, quantity: 1 },
          ],
        },
      },
    });
    console.log(`   ${patients[0].firstName} - ₦8,500 [PENDING]`);

    // Final counts
    const totalPatients = await prisma.patient.count({ where: { hospitalId: hospital.id } });
    const totalVisits = await prisma.visit.count({ where: { hospitalId: hospital.id } });
    const totalVitals = await prisma.vitalSigns.count({ where: { hospitalId: hospital.id } });
    const totalAdmissions = await prisma.admission.count({ where: { hospitalId: hospital.id } });
    const totalRounds = await prisma.nursingRound.count();
    const totalReviews = await prisma.doctorReview.count();

    console.log('\n✅ Seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - SuperAdmin: admin@hms.com / Admin@123');
    console.log('   - Hospital: City General Hospital');
    console.log('   - Staff: 8 users (all Password@123)');
    console.log('   - Inventory: 5 items');
    console.log(`   - Wards: ${wardsData.length} | Beds: ${totalBeds}`);
    console.log(`   - Patients: ${totalPatients}`);
    console.log(`   - Visits: ${totalVisits}`);
    console.log(`   - Vital Signs: ${totalVitals}`);
    console.log(`   - Admissions: ${totalAdmissions} (1 admitted, 1 pending)`);
    console.log(`   - Nursing Rounds: ${totalRounds}`);
    console.log(`   - Doctor Reviews: ${totalReviews}`);
    console.log('   - Prescriptions: 1 | Lab Orders: 5 | Bills: 2\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

seed();
