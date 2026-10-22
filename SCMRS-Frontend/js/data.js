// Sample data for now. The backend person will replace this with real data from the server.
const complaints = [
  {
    id: "FX-001", problem: "Faulty light", category: "Faulty lights", location: "Block A",
    status: "In Progress", date: "12 Oct 2026",
    description: "The corridor light in Block A has not been working for a week, so the area is dark at night.",
    updates: [
      { text: "Complaint submitted", date: "12 Oct 2026" },
      { text: "Under review by maintenance team", date: "12 Oct 2026" },
      { text: "Electrician assigned", date: "13 Oct 2026" }
    ]
  },
  {
    id: "FX-002", problem: "Broken tap", category: "Water problems", location: "Hostel B",
    status: "Pending", date: "10 Oct 2026",
    description: "The tap in the bathroom is leaking and won't stop running. It has been going on for a few days now.",
    updates: [{ text: "Complaint submitted", date: "10 Oct 2026" }]
  },
  {
    id: "FX-003", problem: "Damaged chair", category: "Damaged facilities", location: "Lecture Hall 2",
    status: "Resolved", date: "8 Oct 2026",
    description: "Several chairs in the second row have broken backs and are unsafe to sit on.",
    updates: [
      { text: "Complaint submitted", date: "8 Oct 2026" },
      { text: "Carpenter assigned", date: "9 Oct 2026" },
      { text: "Chairs repaired. Complaint resolved.", date: "11 Oct 2026" }
    ]
  },
  {
    id: "FX-004", problem: "Blocked drainage", category: "Blocked drainage", location: "Behind SUB",
    status: "Pending", date: "5 Oct 2026",
    description: "Water floods the walkway behind the Student Union Building whenever it rains.",
    updates: [{ text: "Complaint submitted", date: "5 Oct 2026" }]
  },
  {
    id: "FX-005", problem: "Broken window", category: "Broken doors and windows", location: "Hostel C",
    status: "Resolved", date: "2 Oct 2026",
    description: "The window in the Hostel C common room is cracked and will not close.",
    updates: [
      { text: "Complaint submitted", date: "2 Oct 2026" },
      { text: "Window replaced. Complaint resolved.", date: "6 Oct 2026" }
    ]
  }
];