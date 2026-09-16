'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Header from '@/components/Header'
import PageEnter from '@/components/PageEnter'
import { BookOpen, CheckCircle2, Lock, PlayCircle, FileText, Award, ChevronRight, ChevronLeft } from 'lucide-react'
import { useToast } from '@/components/ToastProvider'

interface Course {
  id: string
  title: string
  description: string
  category: string
  order_index: number
}

interface Lesson {
  id: string
  course_id: string
  title: string
  content: string
  duration_minutes: number
  order_index: number
  pdf_url: string | null
}

export default function AcademyPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    async function loadAcademy() {
      try {
        const { data: coursesData } = await supabase
          .from('academy_courses')
          .select('*')
          .order('order_index', { ascending: true })
        setCourses(coursesData || [])

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: progressData } = await supabase
            .from('user_academy_progress')
            .select('lesson_id')
            .eq('user_id', user.id)
          setCompletedLessons(progressData?.map((p: any) => p.lesson_id) || [])
        }
      } catch (err) {
        console.error('Error loading academy:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAcademy()
  }, [])

  const loadLessons = async (course: Course) => {
    const { data: lessonsData } = await supabase
      .from('academy_lessons')
      .select('*')
      .eq('course_id', course.id)
      .order('order_index', { ascending: true })
    setLessons(lessonsData || [])
    setSelectedCourse(course)
  }

  const markLessonCompleted = async (lessonId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_academy_progress')
        .insert({ user_id: user.id, lesson_id: lessonId })

      if (error) throw error
      setCompletedLessons(prev => [...prev, lessonId])
      toast.success('Leçon terminée ! Votre progression a été enregistrée.')
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biso-600"></div>
      </div>
    )
  }

  return (
    <PageEnter className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-20">
      <Header displayName="Académie" showBack={true} backUrl="/dashboard" />

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        <div className="text-center space-y-2 animate-fade-in">
          <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100">BISO Academy</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Devenez un expert en investissement et optimisez vos gains.
          </p>
        </div>

        {!selectedCourse ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            {courses.map((course) => (
              <div
                key={course.id}
                className="card p-5 space-y-4 hover:border-emerald-500 transition-all cursor-pointer group"
                onClick={() => loadLessons(course)}
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-500 rounded-full uppercase">
                    {course.category}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-lg group-hover:text-emerald-600 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {course.description}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-gray-400">Cliquez pour débuter</span>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour aux cours
            </button>

            <div className="card p-6 space-y-2">
              <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100">{selectedCourse.title}</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">{selectedCourse.description}</p>
            </div>

            <div className="space-y-3">
              {lessons.length === 0 ? (
                <div className="text-center p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-300 dark:border-zinc-700">
                  <p className="text-sm text-gray-500">Aucune leçon disponible pour ce cours.</p>
                </div>
              ) : (
                lessons.map((lesson, idx) => (
                  <div
                    key={lesson.id}
                    className={`card p-4 flex items-center justify-between gap-4 ${completedLessons.includes(lesson.id) ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${completedLessons.includes(lesson.id) ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}>
                        {completedLessons.includes(lesson.id) ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-bold">{idx + 1}</span>}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{lesson.title}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                          <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> {lesson.duration_minutes} min</span>
                          {lesson.pdf_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => markLessonCompleted(lesson.id)}
                      disabled={completedLessons.includes(lesson.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${completedLessons.includes(lesson.id) ? 'bg-emerald-100 text-emerald-600 cursor-default' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}
                    >
                      {completedLessons.includes(lesson.id) ? 'Terminé' : 'Valider'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </PageEnter>
  )
}
