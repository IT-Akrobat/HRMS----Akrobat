// Auto-generated route list for the employee role.
// Add a page: create the component in ../pages/employee/, import it here, add a { path, element } entry.
import React from 'react';
import Dashboard from '../pages/employee/Dashboard.jsx';
import ProfilePersonal from '../pages/employee/ProfilePersonal.jsx';
import ProfileEmployment from '../pages/employee/ProfileEmployment.jsx';
import Attendance from '../pages/employee/Attendance.jsx';
import AttendanceHistory from '../pages/employee/AttendanceHistory.jsx';
import LeaveApply from '../pages/employee/LeaveApply.jsx';
import LeaveHistory from '../pages/employee/LeaveHistory.jsx';
import LeaveBalance from '../pages/employee/LeaveBalance.jsx';
import Documents from '../pages/employee/Documents.jsx';
import DocumentsDownload from '../pages/employee/DocumentsDownload.jsx';
import PayrollPayslips from '../pages/employee/PayrollPayslips.jsx';
import PayrollSalaryDetails from '../pages/employee/PayrollSalaryDetails.jsx';
import Projects from '../pages/employee/Projects.jsx';
import ProjectsTasks from '../pages/employee/ProjectsTasks.jsx';
import Notifications from '../pages/employee/Notifications.jsx';
import Settings from '../pages/employee/Settings.jsx';

export const employeeRoutes = [
  { path: "dashboard", element: <Dashboard /> },
  { path: "profile/personal", element: <ProfilePersonal /> },
  { path: "profile/employment", element: <ProfileEmployment /> },
  { path: "attendance", element: <Attendance /> },
  { path: "attendance/history", element: <AttendanceHistory /> },
  { path: "leave/apply", element: <LeaveApply /> },
  { path: "leave/history", element: <LeaveHistory /> },
  { path: "leave/balance", element: <LeaveBalance /> },
  { path: "documents", element: <Documents /> },
  { path: "documents/download", element: <DocumentsDownload /> },
  { path: "payroll/payslips", element: <PayrollPayslips /> },
  { path: "payroll/salary-details", element: <PayrollSalaryDetails /> },
  { path: "projects", element: <Projects /> },
  { path: "projects/tasks", element: <ProjectsTasks /> },
  { path: "notifications", element: <Notifications /> },
  { path: "settings", element: <Settings /> },
];
