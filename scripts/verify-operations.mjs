/**
 * Verification test battery for Operations Service migration into Core Backend.
 * Runs against Core Backend on port 5000.
 */

const BASE_URL = process.env.CORE_URL || 'http://localhost:5000';
const SERVICE_TOKEN = process.env.CORE_SERVICE_TOKEN || 'replace-with-a-long-random-string';
const TENANT_ID = 'cmwexxk6u0001nrstmjy98yz5';

const internalHeaders = {
  'Content-Type': 'application/json',
  'x-service-token': SERVICE_TOKEN,
  'x-tenant-id': TENANT_ID,
};

const publicHeaders = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
};

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}:`, detail);
    failed++;
  }
}

async function run() {
  console.log(`\n======================================================`);
  console.log(` Running Operations Service Migration Verification`);
  console.log(` Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/health`, { headers: internalHeaders });
    const json = await res.json();
    assert(res.ok && json.status === 'ok', '1. Internal Service Health Check', json);
  } catch (e) {
    assert(false, '1. Internal Service Health Check', e.message);
  }

  // 2. Service Area Check
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/service-areas/check?zip=85008`, { headers: internalHeaders });
    const json = await res.json();
    assert(
      res.ok && json.data && json.data.isServed === true && json.data.zip === '85008',
      '2. Service Area ZIP Check (85008)',
      json
    );
  } catch (e) {
    assert(false, '2. Service Area ZIP Check', e.message);
  }

  // 3. Caller Address - Save Address 1 (Phoenix)
  const testPhone = `+1602555${Math.floor(1000 + Math.random() * 9000)}`;
  let addr1Id = '';
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/caller-addresses`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        phoneNumber: testPhone,
        label: 'Primary Home',
        address: { street: '1042 E Campbell Ave', city: 'Phoenix', state: 'AZ', zip: '85014' },
      }),
    });
    const json = await res.json();
    addr1Id = json.data?.id;
    assert(res.status === 201 && addr1Id && json.data.address.city === 'Phoenix', '3. Save Caller Address 1 (Phoenix)', json);
  } catch (e) {
    assert(false, '3. Save Caller Address 1', e.message);
  }

  // 4. Caller Address - Lookup with Single Address (ONE_MATCH)
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/caller-addresses/lookup`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ phoneNumber: testPhone }),
    });
    const json = await res.json();
    assert(
      res.ok && json.data.choice.status === 'ONE_MATCH' && json.data.choice.addressId === addr1Id,
      '4. Single Address Lookup -> Returns ONE_MATCH prompt',
      json.data?.choice
    );
  } catch (e) {
    assert(false, '4. Single Address Lookup', e.message);
  }

  // 5. Caller Address - Save Address 2 (Mesa)
  let addr2Id = '';
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/caller-addresses`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        phoneNumber: testPhone,
        label: 'Rental Property',
        address: { street: '450 W Guadalupe Rd', city: 'Mesa', state: 'AZ', zip: '85210' },
      }),
    });
    const json = await res.json();
    addr2Id = json.data?.id;
    assert(res.status === 201 && addr2Id && json.data.address.city === 'Mesa', '5. Save Caller Address 2 (Mesa)', json);
  } catch (e) {
    assert(false, '5. Save Caller Address 2', e.message);
  }

  // 6. Multi-Address Disambiguation -> Returns NEEDS_CLARIFICATION & askBy: city
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/caller-addresses/lookup`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ phoneNumber: testPhone }),
    });
    const json = await res.json();
    const choice = json.data?.choice;
    assert(
      res.ok && choice?.status === 'NEEDS_CLARIFICATION' && choice?.askBy === 'city' && choice?.prompt?.includes('Mesa or Phoenix'),
      '6. Multi-Address Disambiguation -> Prompt: "Mesa or Phoenix?"',
      choice
    );
  } catch (e) {
    assert(false, '6. Multi-Address Disambiguation', e.message);
  }

  // 7. Spoken Answer Match -> Matches Mesa address
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/caller-addresses/lookup`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ phoneNumber: testPhone, answer: 'the Mesa one' }),
    });
    const json = await res.json();
    const choice = json.data?.choice;
    assert(
      res.ok && choice?.status === 'ONE_MATCH' && choice?.addressId === addr2Id,
      '7. Natural Language Resolution -> Answer "the Mesa one" matches Mesa address',
      choice
    );
  } catch (e) {
    assert(false, '7. Natural Language Resolution', e.message);
  }

  // 8. Follow-up Settings Read & Update
  try {
    const getRes = await fetch(`${BASE_URL}/internal/v1/follow-up-settings`, { headers: internalHeaders });
    const getJson = await getRes.json();
    assert(getRes.ok && typeof getJson.data?.feedbackCallDelayMinutes === 'number', '8. Read Follow-Up Timing Settings', getJson);

    const putRes = await fetch(`${BASE_URL}/internal/v1/follow-up-settings`, {
      method: 'PUT',
      headers: internalHeaders,
      body: JSON.stringify({ feedbackCallDelayMinutes: 240, isTechnicianCheckInEnabled: true, technicianCheckInDelayMinutes: 45 }),
    });
    const putJson = await putRes.json();
    assert(
      putRes.ok && putJson.data?.feedbackCallDelayMinutes === 240 && putJson.data?.technicianCheckInDelayMinutes === 45,
      '9. Update Follow-Up Timing Settings (45 min check-in)',
      putJson
    );
  } catch (e) {
    assert(false, '8/9. Follow-Up Timing Settings', e.message);
  }

  // 10. Technician Mid-Job Check-In
  try {
    const res = await fetch(`${BASE_URL}/internal/v1/technician-check-ins`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        serviceRequestId: '00000000-0000-0000-0000-000000000001',
        retellCallId: `call_test_${Date.now()}`,
        progress: 'Compressor capacitor replaced, testing cold air return.',
        challenges: 'Tight attic crawlspace',
        isHelpNeeded: false,
        expectedFinishMinutes: 25,
      }),
    });
    const json = await res.json();
    assert(res.status === 201 && json.data?.id, '10. Record Technician Check-In from Voice Agent', json);
  } catch (e) {
    assert(false, '10. Record Technician Check-In', e.message);
  }

  // 11. Public Service Area CRUD (Frontend API)
  let testAreaId = '';
  try {
    const postRes = await fetch(`${BASE_URL}/api/v1/service-areas`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ name: 'East Valley North', zipCodes: ['85250', '85251'] }),
    });
    const postJson = await postRes.json();
    testAreaId = postJson.data?.id;
    assert(postRes.status === 201 && testAreaId && postJson.data.zipCodes.includes('85250'), '11. Public API: Create Service Area with ZIPs', postJson);

    const delRes = await fetch(`${BASE_URL}/api/v1/service-areas/${testAreaId}`, {
      method: 'DELETE',
      headers: publicHeaders,
    });
    assert(delRes.status === 204, '12. Public API: Delete Service Area', delRes.status);
  } catch (e) {
    assert(false, '11/12. Public Service Area CRUD', e.message);
  }

  console.log(`\n======================================================`);
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
