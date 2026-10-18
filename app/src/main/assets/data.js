// Timetable data for the Fall 2026–27 term.
// Days follow Date.getDay(): 1 = Monday … 5 = Friday. Office hours are [day, start, end].
// Sources: IUS student portal, the tutorial announcement, and IUS eCampus (syllabi and office hours).
window.SCHEDULE = {
  updated: '2026-10-18',

  courses: {
    ns: {
      code: 'NS102.1',
      name: 'Physics',
      ects: 6,
      noTutorial: { en: 'Not announced yet', tr: 'Henüz açıklanmadı' },
      note: {
        en: 'The lecturer has not announced the tutorial time yet. eCampus lists Wed 18:00–19:50 in B F2.6, but that is out of date.',
        tr: 'Hoca tutorial saatini henüz açıklamadı. eCampus\'ta Çar 18:00–19:50, B F2.6 yazıyor ama bu bilgi güncel değil.'
      },
      people: [
        { name: 'Adnan Mašić', title: 'Visiting Professor', duty: 'lecturer', email: 'amasic@ius.edu.ba', ohNote: 'notPublished' },
        { name: 'Muhamed Bisić', title: 'Senior Assistant', office: 'A F3.26', oh: [[3, '14:00', '16:00'], [4, '14:00', '16:00'], [5, '14:00', '16:00']] }
      ]
    },
    cs: {
      code: 'CS103.2',
      name: 'Introduction to Programming',
      ects: 6,
      coordinator: 'Assoc. Prof. Dr. Özge Büyükdağlı',
      people: [
        { name: 'Kanita Karađuzović-Hadžiabdić', title: 'Assoc. Prof. Dr.', office: 'B F3.13', oh: [[1, '11:00', '12:00'], [1, '15:00', '17:00'], [2, '10:00', '12:00']] },
        { name: 'Nesibe Merve Husejnović', title: 'Senior Assistant', office: 'A F2.32', email: 'ndemir@ius.edu.ba', oh: [[2, '13:00', '15:00'], [3, '12:00', '13:00'], [4, '10:00', '12:00']] }
      ]
    },
    math: {
      code: 'MATH101.3',
      name: 'Calculus I',
      ects: 6,
      note: {
        en: 'You attend tutorial Section 5. Your own section\'s tutorial is Thu 09:00–10:50 in A F2.14.',
        tr: 'Tutorial\'da Section 5\'e gidiyorsun. Kendi şubenin tutorial\'ı Per 09:00–10:50, A F2.14.'
      },
      people: [
        { name: 'Leila Miller', title: 'Prof. Dr.', duty: 'lecturer', office: 'A F1.32', email: 'lmiller@ius.edu.ba', oh: [[1, '12:00', '14:00'], [2, '11:00', '12:00'], [3, '13:00', '14:00'], [4, '10:00', '11:00']] },
        { name: 'Ilma Papic', duty: 'assistant', email: 'itarhanis-papic@ius.edu.ba' },
        { name: 'Tarik-Alan Tatarevic', duty: 'tutorial', ohNote: 'notListed' }
      ]
    },
    ens: {
      code: 'ENS101.2',
      name: 'Introduction to Engineering',
      ects: 3,
      note: {
        en: 'ENS101.2\'s own tutorial (Mon 13:00) clashes with CS103.2, so you attend Section 3.',
        tr: 'ENS101.2\'nin kendi tutorial\'ı (Pzt 13:00) CS103.2 ile çakışıyor, bu yüzden Section 3\'e gidiyorsun.'
      },
      people: [
        { name: 'Tarik Namas', title: 'Assoc. Prof. Dr.', duty: 'lecturer', office: 'B F3.15', email: 'tnamas@ius.edu.ba', oh: [[2, '14:00', '16:00'], [3, '14:00', '16:00'], [4, '15:00', '16:00']] },
        { name: 'Zerina Tanović', title: 'Assistant', office: 'A F3.26', oh: [[1, '10:00', '11:00'], [3, '15:00', '17:00'], [5, '10:00', '12:00']] },
        { name: 'Anes Hadziomerovic', duty: 'robotics', email: 'ahadziomerovic@ius.edu.ba' }
      ]
    },
    elit: {
      code: 'ELIT100.9',
      name: 'Academic English and Effective Communication',
      ects: 6,
      coordinator: 'Assoc. Prof. Dr. Ervin Kovačević',
      people: [
        { name: 'Nadira Puškar Mustafić', title: 'Assistant Professor', office: 'B F2.26', oh: [[2, '13:00', '15:00'], [4, '13:00', '15:00'], [5, '10:00', '12:00']] },
        { name: 'Minja Arslanagić-Tutić', title: 'Adjunct Instructor', ohNote: 'notListed' }
      ]
    }
  },

  // t: 'lec' (lecture) or 'tut' (tutorial). sec is the tutorial section number on eCampus.
  events: [
    { c: 'ns',   t: 'lec', d: 1, s: '09:00', e: '11:50', room: 'B F1.23', who: 'Adnan Mašić, Muhamed Bisić' },
    { c: 'cs',   t: 'lec', d: 1, s: '12:00', e: '14:50', room: 'B F2.15', who: 'Kanita Karađuzović-Hadžiabdić, Nesibe Merve Husejnović' },
    { c: 'ens',  t: 'tut', d: 1, s: '15:00', e: '15:50', room: 'RC1.2', sec: 3 },
    { c: 'math', t: 'tut', d: 1, s: '17:00', e: '18:50', room: 'B F2.15', sec: 5, who: 'Tarik-Alan Tatarevic' },
    { c: 'math', t: 'lec', d: 2, s: '09:00', e: '11:50', room: 'A F2.14', who: 'Leila Miller' },
    { c: 'ens',  t: 'lec', d: 2, s: '13:00', e: '14:50', room: 'B F2.15', who: 'Zerina Tanović, Tarik Namas' },
    { c: 'elit', t: 'lec', d: 2, s: '16:00', e: '18:50', room: 'B F2.2', who: 'Minja Arslanagić-Tutić, Nadira Puškar Mustafić' },
    { c: 'cs',   t: 'tut', d: 4, s: '11:00', e: '12:50', room: 'B F1.25', sec: 2 }
  ]
};
