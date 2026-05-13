# Interviewer and Project Manager Workflow Implementation

This plan outlines the steps required to complete Task 1 (Building PM and Interviewer Dashboards & Interview Views) and Task 2 (Finalizing the PDF Document Generation & Download workflow).

## Task 1: Interviewer and Project Manager Platforms

Currently, the `ProjectManager` and `Interviewer` folders have shell components (e.g., `dashboard`, `individual-interview`, `group-interview`). We need to populate these and wire up the navigation.

### Proposed Changes

#### 1. Routing Updates (`src/app/app.routes.ts`)
Update the routes to properly map to the specific components you've created for the PM and Interviewer, rather than reusing the Admin components:
- `/pm/dashboard` -> `pages/ProjectManager/dashboard/dashboard.ts`
- `/pm/individual-interview` -> `pages/ProjectManager/individual-interview/individual-interview.ts`
- `/pm/group-interview` -> `pages/ProjectManager/group-interview/group-interview.ts`
- `/interviewer/dashboard` -> `pages/Interviewer/dashboard/dashboard.ts`
- `/interviewer/individual-interview` -> `pages/Interviewer/individual-interview/individual-interview.ts`
- `/interviewer/group-interview` -> `pages/Interviewer/group-interview/group-interview.ts`

#### 2. Layout & Sidebar (`src/app/components/layout/layout.ts` & `layout.html`)
Update the sidebar for the `pm` and `interviewer` roles to show:
- Dashboard
- Individual Interviews
- Group Interviews
- Profile

#### 3. Dashboards (`pages/ProjectManager/dashboard` & `pages/Interviewer/dashboard`)
We will mirror the look of the admin/hr dashboard but simplify it for these roles. They do not need to create quizzes or manage users. The dashboard will strictly show their pending evaluation metrics and a quick action link to navigate to their interviews.

#### 4. Individual & Group Interview Components
For both PM and Interviewer roles, we will copy the functionality from the Admin/HR `individual-interview` and `group-interview` modules. However, we will restrict administrative capabilities:
- **Remove** the "Create New Interview" button.
- **Remove** the "Delete Interview" action.
- **Remove** the "Final Decision" accept/reject section since only Admin/HR should finalize the overall hiring decision.
- **Keep** the interview list (which correctly filters to only the interviews they are assigned to).
- **Keep** the "Evaluation" form inside the interview detail modal so they can submit their own comments and recommendations.

## Task 2: Evaluation Summary Document & Download

Once the PM and Interviewer can successfully submit their evaluations, we will solidify the PDF download button logic.

Currently, we added a "Download PDF" button in the HR/Admin individual interview modal. Based on your request, we will ensure that:
1. The **Download Evaluation Summary** button is prominently visible in the Interview Details modal across all roles (Admin, HR, PM, Interviewer).
2. The button will generate the structured PDF form (matching Images 3 & 4), containing pre-filled sections for:
   - Interviewer Comments, Recommendation, Signature, and Date
   - PM Comments, Recommendation, Signature, and Date
   - HR Comments, Recommendation, Signature, and Date
3. Data from the database will seamlessly populate these sections. If a specific crew member hasn't evaluated yet, their section will print blank so it can be physically filled if desired, just like we implemented for HR in the previous session.

## User Review Required

> [!IMPORTANT]
> - Are you okay with removing the "Create New Interview" and "Finalize Decision" buttons from the PM and Interviewer views? (Usually, only Admins or HR schedule the interviews and make the final hire/reject decision).
> - Should the "Download Evaluation Summary" button only be enabled/visible after **everyone** (HR, PM, Interviewers) has completed their evaluations, or should they be able to download a partially filled document at any time? Currently, the logic restricts downloading until everyone has finished.

Please approve this plan so I can start executing Task 1 immediately!
