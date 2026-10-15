export const COMMUNITY_TAGS=['AI','ML','Projects','Help','Events','Announcements'];
export function communityPath(session){return session?.role==='admin'?'/admin/community':'/student/community';}
