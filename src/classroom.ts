import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { Assignment } from './types';

const CREDENTIALS_FILE = 'credentials.json';

export function getAuthClient(kidName: string): OAuth2Client {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const tokenPath = path.join('tokens', `${kidName.toLowerCase()}.json`);
  const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  oAuth2Client.setCredentials(tokens);

  // Persist refreshed tokens automatically
  oAuth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
  });

  return oAuth2Client;
}

export async function getAssignments(kidName: string): Promise<Assignment[]> {
  const auth = getAuthClient(kidName);
  const classroom = google.classroom({ version: 'v1', auth });

  const coursesRes = await classroom.courses.list({ studentId: 'me' });
  const courses = coursesRes.data.courses || [];

  const assignments: Assignment[] = [];

  for (const course of courses) {
    // Fetch all courseWork for this course upfront (fewer API calls)
    const cwRes = await classroom.courses.courseWork.list({ courseId: course.id! });
    const courseWorkMap = new Map(
      (cwRes.data.courseWork || []).map((cw) => [cw.id!, cw])
    );

    // Fetch only incomplete submissions for this student
    const subsRes = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: course.id!,
      courseWorkId: '-',
      userId: 'me',
      states: ['NEW', 'CREATED'],
    });

    for (const sub of subsRes.data.studentSubmissions || []) {
      const cw = courseWorkMap.get(sub.courseWorkId!);
      if (!cw) continue;

      let dueDate: Date | undefined;
      if (cw.dueDate) {
        dueDate = new Date(
          cw.dueDate.year!,
          cw.dueDate.month! - 1,
          cw.dueDate.day!,
          cw.dueTime?.hours ?? 23,
          cw.dueTime?.minutes ?? 59
        );
      }

      assignments.push({
        id: sub.id!,
        courseId: course.id!,
        courseName: course.name!,
        title: cw.title!,
        dueDate,
        createdTime: new Date(sub.creationTime!),
        state: sub.state!,
      });
    }
  }

  return assignments;
}
