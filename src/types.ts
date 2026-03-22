export interface Assignment {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  dueDate?: Date;
  createdTime: Date;
  state: string;
}

export interface Kid {
  name: string;
}

export interface Config {
  kids: Kid[];
}
