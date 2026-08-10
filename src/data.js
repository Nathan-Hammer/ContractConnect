export const seedData = {
  companies: [
    { id: 'c1', name: 'Namib Horizon Logistics', industry: 'Logistics', location: 'Walvis Bay', status: 'Active', website: 'namibhorizon.na', phone: '+264 64 220 184', owner: 'Nandi Shilongo', initials: 'NH', color: '#e07045', notes: 'Strategic freight and warehousing partner.' },
    { id: 'c2', name: 'Kalahari Systems', industry: 'Technology', location: 'Windhoek', status: 'Active', website: 'kalaharisystems.com', phone: '+264 61 401 920', owner: 'Michael Amutenya', initials: 'KS', color: '#498f81', notes: 'Cloud infrastructure and managed services provider.' },
    { id: 'c3', name: 'Coastal Energy Group', industry: 'Energy', location: 'Swakopmund', status: 'Renewal due', website: 'coastalenergy.na', phone: '+264 64 460 211', owner: 'Nandi Shilongo', initials: 'CE', color: '#546fa8', notes: 'Quarterly service review required.' },
    { id: 'c4', name: 'Oryx Advisory', industry: 'Professional services', location: 'Windhoek', status: 'Active', website: 'oryxadvisory.com', phone: '+264 61 303 518', owner: 'Selma Uusiku', initials: 'OA', color: '#9568a8', notes: 'Finance and compliance advisory partner.' },
    { id: 'c5', name: 'Etosha Foods', industry: 'Manufacturing', location: 'Tsumeb', status: 'Prospect', website: 'etoshafoods.na', phone: '+264 67 221 448', owner: 'Michael Amutenya', initials: 'EF', color: '#b18b43', notes: 'Introductory meetings in progress.' },
  ],
  contacts: [
    { id: 'p1', companyId: 'c1', name: 'Anna Ndapewa', role: 'Operations Director', email: 'anna@namibhorizon.na', phone: '+264 81 291 4803', primary: true },
    { id: 'p2', companyId: 'c1', name: 'Petrus Iipumbu', role: 'Finance Manager', email: 'petrus@namibhorizon.na', phone: '+264 81 442 9105', primary: false },
    { id: 'p3', companyId: 'c2', name: 'Elias Katjiuanjo', role: 'Managing Director', email: 'elias@kalaharisystems.com', phone: '+264 85 674 0102', primary: true },
    { id: 'p4', companyId: 'c3', name: 'Julia Amadhila', role: 'Commercial Manager', email: 'julia@coastalenergy.na', phone: '+264 81 300 7021', primary: true },
    { id: 'p5', companyId: 'c4', name: 'Riaan van Wyk', role: 'Senior Partner', email: 'riaan@oryxadvisory.com', phone: '+264 81 209 8831', primary: true },
    { id: 'p6', companyId: 'c5', name: 'Lydia Hamutenya', role: 'Head of Procurement', email: 'lydia@etoshafoods.na', phone: '+264 81 577 2900', primary: true },
  ],
  contracts: [
    { id: 'k1', companyId: 'c1', title: 'Freight Services Agreement', value: 485000, startDate: '2026-01-01', endDate: '2026-12-31', status: 'Active', renewalNoticeDays: 60, autoRenew: true, terminationNoticeDate: '2026-11-01' },
    { id: 'k2', companyId: 'c2', title: 'Managed Cloud Services', value: 720000, startDate: '2025-10-01', endDate: '2026-09-30', status: 'Active', renewalNoticeDays: 60, autoRenew: true, terminationNoticeDate: '2026-08-01' },
    { id: 'k3', companyId: 'c3', title: 'Maintenance & Support', value: 315000, startDate: '2025-09-15', endDate: '2026-08-31', status: 'Expiring soon', renewalNoticeDays: 60, autoRenew: false, terminationNoticeDate: '2026-08-15' },
    { id: 'k4', companyId: 'c4', title: 'Compliance Advisory Retainer', value: 264000, startDate: '2026-02-01', endDate: '2027-01-31', status: 'Active', renewalNoticeDays: 90, autoRenew: false, terminationNoticeDate: '2026-11-02' },
  ],
  interactions: [
    { id: 'i1', companyId: 'c1', contactId: 'p1', type: 'Meeting', date: '2026-08-01', summary: 'Quarterly operations review', notes: 'Reviewed delivery KPIs. Anna will send the revised route schedule by Friday.' },
    { id: 'i2', companyId: 'c2', contactId: 'p3', type: 'Call', date: '2026-07-29', summary: 'Cloud capacity planning', notes: 'Discussed capacity requirements for the next quarter.' },
    { id: 'i3', companyId: 'c3', contactId: 'p4', type: 'Email', date: '2026-07-26', summary: 'Renewal proposal sent', notes: 'Shared updated pricing and scope for the maintenance renewal.' },
    { id: 'i4', companyId: 'c4', contactId: 'p5', type: 'Meeting', date: '2026-07-18', summary: 'Compliance planning session', notes: 'Agreed on the review calendar for the remainder of 2026.' },
    { id: 'i5', companyId: 'c1', contactId: 'p2', type: 'Email', date: '2026-07-11', summary: 'Invoice query resolved', notes: 'Confirmed adjustment on the July statement.' },
  ],
  followups: [
    { id: 'f1', companyId: 'c1', contactId: 'p1', title: 'Review revised route schedule', dueDate: '2026-08-07', priority: 'High', completed: false },
    { id: 'f2', companyId: 'c3', contactId: 'p4', title: 'Follow up on renewal proposal', dueDate: '2026-08-10', priority: 'High', completed: false },
    { id: 'f3', companyId: 'c2', contactId: 'p3', title: 'Confirm capacity forecast', dueDate: '2026-08-14', priority: 'Medium', completed: false },
  ],
}
