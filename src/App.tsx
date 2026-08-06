import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/features/auth/auth-context"
import { ProtectedRoute } from "@/features/auth/protected-route"
import { RequireRole } from "@/features/auth/require-role"
import { LoginPage } from "@/features/auth/login-page"
import { ResetPasswordPage } from "@/features/auth/reset-password-page"
import { AppLayout } from "@/components/layout/app-layout"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { VolunteersPage } from "@/features/volunteers/volunteers-page"
import { VolunteerProfilePage } from "@/features/volunteers/volunteer-profile-page"
import { DepartmentsPage } from "@/features/departments/departments-page"
import { DepartmentDetailPage } from "@/features/departments/department-detail-page"
import { EventsPage } from "@/features/events/events-page"
import { EventDetailPage } from "@/features/events/event-detail-page"
import { BoothDetailPage } from "@/features/events/booth-detail-page"
import { TasksPage } from "@/features/tasks/tasks-page"
import { EvaluationsPage } from "@/features/evaluations/evaluations-page"
import { EvaluationGroupsPage } from "@/features/evaluations/evaluation-groups-page"
import { EvaluateGroupPage } from "@/features/evaluations/evaluate-group-page"
import { MonthlyEvaluationPage } from "@/features/evaluations/monthly-evaluation-page"
import { TerminationsPage } from "@/features/volunteers/terminations-page"
import { FormsPage } from "@/features/forms/forms-page"
import { FormBuilderPage } from "@/features/forms/form-builder-page"
import { FormResponsesPage } from "@/features/forms/form-responses-page"
import { PublicFormPage } from "@/features/forms/public-form-page"
import { MyProfilePage } from "@/features/auth/my-profile-page"
import { NotificationsPage } from "@/features/notifications/notifications-page"
import { SignupPage } from "@/features/auth/signup-page"
import { InterviewsPage } from "@/features/interviews/interviews-page"
import { ReportsPage } from "@/features/reports/reports-page"
import { UsersPage } from "@/features/users/users-page"
import { ImportPage } from "@/features/import/import-page"
import { SettingsPage } from "@/features/settings/settings-page"

const ADMIN_ROLES = ["super_admin", "admin"] as const

function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/f/:slug" element={<PublicFormPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="profile" element={<MyProfilePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="volunteers" element={<VolunteersPage />} />
                <Route path="volunteers/:id" element={<VolunteerProfilePage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="departments/:id" element={<DepartmentDetailPage />} />
                <Route path="departments/:id/monthly" element={<MonthlyEvaluationPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:id" element={<EventDetailPage />} />
                <Route path="events/:id/booths/:boothId" element={<BoothDetailPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="evaluations" element={<EvaluationsPage />} />
                <Route path="evaluations/:eventId" element={<EvaluationGroupsPage />} />
                <Route
                  path="evaluations/:eventId/:groupType/:groupId"
                  element={<EvaluateGroupPage />}
                />

                <Route element={<RequireRole roles={[...ADMIN_ROLES]} />}>
                  <Route path="interviews" element={<InterviewsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="forms" element={<FormsPage />} />
                  <Route path="forms/new" element={<FormBuilderPage />} />
                  <Route path="forms/:id/edit" element={<FormBuilderPage />} />
                  <Route path="forms/:id/responses" element={<FormResponsesPage />} />
                  <Route path="terminations" element={<TerminationsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="import" element={<ImportPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App