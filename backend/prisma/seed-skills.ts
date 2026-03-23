import prisma from '../src/config/prisma';

async function seedSkills() {
  // ── SkillLevels ──────────────────────────────────────────────
  const levels = [
    { level: 1, name: 'Cần hướng dẫn', description: 'Biết cơ bản, cần người kèm khi làm.' },
    { level: 2, name: 'Làm độc lập', description: 'Giao việc là xong, không cần hỏi nhiều.' },
    { level: 3, name: 'Có thể Lead/Review', description: 'Có thể thiết kế và dạy lại cho người khác.' },
  ];
  for (const l of levels) {
    await prisma.skillLevel.upsert({ where: { level: l.level }, update: l, create: l });
  }

  // ── Categories & Skills ──────────────────────────────────────
  const data: { name: string; sortOrder: number; skills: string[] }[] = [
    { name: 'Core Technical', sortOrder: 1, skills: ['Java / Spring Boot', 'React / Frontend'] },
    { name: 'Database', sortOrder: 2, skills: ['MySQL'] },
    { name: 'Infrastructure', sortOrder: 3, skills: ['Redis'] },
    { name: 'Cloud', sortOrder: 4, skills: ['AWS'] },
    { name: 'Design Skills', sortOrder: 5, skills: ['Detail Design', 'Basic Design'] },
    { name: 'Architecture', sortOrder: 6, skills: ['System Arch'] },
    { name: 'Testing', sortOrder: 7, skills: ['Unit Test (JUnit)', 'API Test (Postman)'] },
    { name: 'AI Tools', sortOrder: 8, skills: ['Cursor', 'ChatGPT', 'GitHub Copilot'] },
    // Construction Skills & Other: skills được thêm thủ công qua UI
    { name: 'Construction Skills', sortOrder: 9, skills: [] },
    { name: 'Other', sortOrder: 10, skills: [] },
  ];

  for (const cat of data) {
    const category = await prisma.skillCategory.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: { name: cat.name, sortOrder: cat.sortOrder },
    });
    for (let i = 0; i < cat.skills.length; i++) {
      await prisma.skill.upsert({
        where: { name_categoryId: { name: cat.skills[i], categoryId: category.id } },
        update: {},
        create: { name: cat.skills[i], categoryId: category.id, sortOrder: i + 1 },
      });
    }
  }

  console.log('✅ Skills seeded successfully');
}

seedSkills()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
