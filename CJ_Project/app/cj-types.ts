export type Subject = {
  id: string;
  name: string;
  shortName: string;
  color: string;
};

export type Exam = {
  id: string;
  weekStart: string;
  dayIndex: number;
  title: string;
  time: string;
  location: string;
  note: string;
  updatedAt: string;
};

export type CJEntry = {
  id: string;
  weekStart: string;
  dayIndex: number;
  period: number;
  subjectId: string;
  ic: string;
  hw: string;
  announcement: string;
  updatedAt: string;
};

export type CJPayload = {
  weekStart: string;
  subjects: Subject[];
  entries: CJEntry[];
  exams: Exam[];
};
