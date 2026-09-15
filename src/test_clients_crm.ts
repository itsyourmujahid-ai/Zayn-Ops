/**
 * Verification test suite for ZaynOps Client Management + Lead-to-Client Relationship.
 * Tests A through J as strictly specified in the requirements.
 */
import {
  createLead,
  createClient,
  createClientFromLead,
  transferClientOwnership,
  createOpportunityForClient,
  getClients,
  getClientById,
  getLocalClients,
  getLocalLeads,
  getLeadById,
  setEffectiveSession,
  clearEffectiveSession,
} from './lib/dal';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING ZAYNOPS CRM CLIENT MODULE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const companyA = `test_company_a_${timestamp}`;
    const companyB = `test_company_b_${timestamp}`;

    const adminId = `admin_${timestamp}`;
    const salesman1 = `salesman_1_${timestamp}`;
    const salesman2 = `salesman_2_${timestamp}`;

    // =========================================================================
    // TEST A: Convert won lead -> Client created
    // =========================================================================
    setEffectiveSession({
      userId: salesman1,
      userName: 'Salim Al-Harthy',
      userRole: 'SALESMAN',
      companyId: companyA,
    });

    const testPhoneA = `+968 9123 ${Math.floor(1000 + Math.random() * 9000)}`;
    const lead1 = await createLead({
      company_id: companyA,
      company_name: `Bahwan Projects ${timestamp}`,
      contact_person: 'Sheikh Salim',
      phone: testPhoneA,
      status: 'Won',
      assigned_to: salesman1,
    });

    const clientA = await createClientFromLead({
      lead_id: lead1.id,
      company_name: lead1.company_name,
      contact_person: lead1.contact_person,
      phone: lead1.phone,
      owner_id: salesman1,
    });

    const lead1After = await getLeadById(lead1.id);

    assert(
      !!clientA &&
        clientA.company_id === companyA &&
        clientA.owner_id === salesman1 &&
        lead1After?.client_id === clientA.id &&
        lead1After?.converted_to_client_id === clientA.id,
      'TEST A: Convert won lead -> Client created',
      `Client created with ID: ${clientA?.id}, Lead client_id: ${lead1After?.client_id}`
    );

    // =========================================================================
    // TEST B: Convert second won lead same phone -> Links to existing client
    // =========================================================================
    const lead2 = await createLead({
      company_id: companyA,
      company_name: `Bahwan Projects Phase 2 ${timestamp}`,
      contact_person: 'Sheikh Salim',
      phone: testPhoneA, // Same phone as lead1
      status: 'Won',
      assigned_to: salesman1,
    });

    const clientB = await createClientFromLead({
      lead_id: lead2.id,
      company_name: lead2.company_name,
      contact_person: lead2.contact_person,
      phone: lead2.phone,
      owner_id: salesman1,
    });

    const lead2After = await getLeadById(lead2.id);
    const clientAAfter = await getClientById(clientA.id);

    assert(
      clientB.id === clientA.id &&
        lead2After?.client_id === clientA.id &&
        (clientAAfter?.related_lead_ids?.includes(lead2.id) || false),
      'TEST B: Convert second won lead same phone -> Links to existing client',
      `Client returned: ${clientB.id}, Original client: ${clientA.id}, Related leads: ${JSON.stringify(
        clientAAfter?.related_lead_ids
      )}`
    );

    // =========================================================================
    // TEST C: Duplicate direct client blocked by phone
    // =========================================================================
    let testCBlocked = false;
    try {
      await createClient({
        company_id: companyA,
        company_name: 'Attempt Duplicate Client',
        contact_person: 'Duplicate Person',
        phone: testPhoneA, // Duplicate phone in same company
      });
    } catch (err: any) {
      testCBlocked = true;
    }

    assert(
      testCBlocked,
      'TEST C: Duplicate direct client blocked by phone',
      'Duplicate phone was properly rejected'
    );

    // =========================================================================
    // TEST D: Duplicate client allowed across different companies
    // =========================================================================
    // Switch session to Company B
    setEffectiveSession({
      userId: `user_comp_b_${timestamp}`,
      userName: 'Company B User',
      userRole: 'SALESMAN',
      companyId: companyB,
    });

    let clientCompanyB = null;
    try {
      clientCompanyB = await createClient({
        company_id: companyB,
        company_name: `Bahwan Branch B ${timestamp}`,
        contact_person: 'Sheikh Salim B',
        phone: testPhoneA, // Same phone, but DIFFERENT company
      });
    } catch (err: any) {
      console.error('Company B creation unexpected error:', err);
    }

    assert(
      !!clientCompanyB && clientCompanyB.company_id === companyB,
      'TEST D: Duplicate client allowed across different companies',
      `Company B client created with ID ${clientCompanyB?.id}`
    );

    // =========================================================================
    // TEST E: Super Admin can view all clients
    // =========================================================================
    setEffectiveSession({
      userId: `super_admin_${timestamp}`,
      userName: 'VVIP Super Admin',
      userRole: 'SUPER_ADMIN',
    });

    const superAdminClients = await getClients({ userRole: 'SUPER_ADMIN' });
    const hasCompanyA = superAdminClients.some((c) => c.company_id === companyA);
    const hasCompanyB = superAdminClients.some((c) => c.company_id === companyB);

    assert(
      hasCompanyA && hasCompanyB,
      'TEST E: Super Admin can view all clients',
      `Super admin retrieved ${superAdminClients.length} clients across companies`
    );

    // =========================================================================
    // TEST F: Salesman can view own clients
    // =========================================================================
    setEffectiveSession({
      userId: salesman1,
      userName: 'Salim Al-Harthy',
      userRole: 'SALESMAN',
      companyId: companyA,
    });

    const salesman1Clients = await getClients({ userRole: 'SALESMAN' });
    const ownClientFound = salesman1Clients.some((c) => c.id === clientA.id && c.owner_id === salesman1);

    assert(
      ownClientFound,
      'TEST F: Salesman can view own clients',
      `Salesman 1 retrieved ${salesman1Clients.length} owned clients`
    );

    // =========================================================================
    // TEST G: Salesman CANNOT view other salesmen's clients
    // =========================================================================
    // Create client owned by salesman 2 in company A
    setEffectiveSession({
      userId: salesman2,
      userName: 'Ahmed Al-Kindi',
      userRole: 'SALESMAN',
      companyId: companyA,
    });

    const testPhoneSalesman2 = `+968 9555 ${Math.floor(1000 + Math.random() * 9000)}`;
    const clientSalesman2 = await createClient({
      company_id: companyA,
      company_name: `Kindi Trading ${timestamp}`,
      contact_person: 'Ahmed Kindi',
      phone: testPhoneSalesman2,
    });

    // Now switch back to Salesman 1: Salesman 1 MUST NOT see Salesman 2's client
    setEffectiveSession({
      userId: salesman1,
      userName: 'Salim Al-Harthy',
      userRole: 'SALESMAN',
      companyId: companyA,
    });

    const salesman1List = await getClients({ userRole: 'SALESMAN' });
    const canSeeOtherClient = salesman1List.some((c) => c.id === clientSalesman2.id);
    const directAccessOtherClient = await getClientById(clientSalesman2.id, 'SALESMAN');

    assert(
      !canSeeOtherClient && directAccessOtherClient === null,
      "TEST G: Salesman CANNOT view other salesmen's clients",
      `In list: ${canSeeOtherClient}, Direct get: ${directAccessOtherClient !== null}`
    );

    // =========================================================================
    // TEST H: Transfer client ownership -> updates client owner
    // =========================================================================
    // Admin transfers clientA from salesman 1 to salesman 2
    setEffectiveSession({
      userId: adminId,
      userName: 'Company Admin',
      userRole: 'ADMIN',
      companyId: companyA,
    });

    await transferClientOwnership({
      client_id: clientA.id,
      new_owner_id: salesman2,
      new_owner_name: 'Ahmed Al-Kindi',
      reason: 'Portfolio rebalancing',
    });

    const clientAfterTransfer = await getClientById(clientA.id, 'ADMIN');

    assert(
      clientAfterTransfer?.owner_id === salesman2,
      'TEST H: Transfer client ownership -> updates client owner',
      `Client owner is now: ${clientAfterTransfer?.owner_id} (Expected: ${salesman2})`
    );

    // =========================================================================
    // TEST I: Transfer client ownership -> does NOT change lead assigned_to
    // =========================================================================
    const originalLead1 = await getLeadById(lead1.id);

    assert(
      originalLead1?.assigned_to === salesman1,
      'TEST I: Transfer client ownership -> does NOT change lead assigned_to',
      `Lead 1 assigned_to remains: ${originalLead1?.assigned_to} (Original salesman: ${salesman1})`
    );

    // =========================================================================
    // TEST J: Create new opportunity -> new lead linked to client
    // =========================================================================
    const opportunityLead = await createOpportunityForClient({
      client_id: clientA.id,
      project_name: 'Annual Facilities Management 2027',
      estimated_value: 45000,
      priority: 'Hot',
      requirement: 'Full HVAC and civil maintenance contract',
    });

    const clientAAfterOpportunity = await getClientById(clientA.id, 'ADMIN');

    assert(
      opportunityLead.source_client_id === clientA.id &&
        opportunityLead.client_id === clientA.id &&
        (clientAAfterOpportunity?.related_lead_ids?.includes(opportunityLead.id) || false),
      'TEST J: Create new opportunity -> new lead linked to client',
      `New Lead ID: ${opportunityLead.id}, source_client_id: ${opportunityLead.source_client_id}, client related_lead_ids: ${JSON.stringify(
        clientAAfterOpportunity?.related_lead_ids
      )}`
    );

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('====================================================');

    if (failed === 0) {
      console.log('🎉 ALL 10 TESTS (A through J) PASSED SUCCESSFULLY!');
    }
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    clearEffectiveSession();
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
