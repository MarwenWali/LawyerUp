import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, ScrollView,
  Modal, Platform, Keyboard, TouchableWithoutFeedback,
  ActivityIndicator, Alert, Image, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/useTheme';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { SPECIALIZATIONS } from '@/constants/mockData';
import { lawyersApi, contactsApi, reviewsApi, BASE_URL } from '@/services/api';
import { messageService } from '@/src/services/messageService';

// â”€â”€ Star display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Stars({ rating, size = 14, color = '#D4A03C' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? color : '#ccc'}
        />
      ))}
    </View>
  );
}

// â”€â”€ Interactive star picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StarPicker({ value, onChange, size = 32, C }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Pressable
          key={i}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            onChange(i);
          }}
          hitSlop={8}
        >
          <Ionicons
            name={i <= value ? 'star' : 'star-outline'}
            size={size}
            color={i <= value ? C.accent : C.mutedForeground}
          />
        </Pressable>
      ))}
    </View>
  );
}

// â”€â”€ Rating bar breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RatingBreakdown({ breakdown, total, C }) {
  if (!total) return null;
  return (
    <View style={{ gap: 4, marginTop: 8 }}>
      {breakdown.map(({ star, count }) => (
        <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary, width: 8 }}>{star}</Text>
          <Ionicons name="star" size={10} color={C.accent} />
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.muted, overflow: 'hidden' }}>
            <View style={{ width: `${total ? (count / total) * 100 : 0}%`, height: '100%', borderRadius: 3, backgroundColor: C.accent }} />
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground, width: 20, textAlign: 'right' }}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

// â”€â”€ Review item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReviewItem({ review, isOwn, onDelete, C }) {
  const initials = (review.reviewer_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const date = new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <View style={[reviewStyles.item, { backgroundColor: C.muted, borderColor: C.border }]}>
      <View style={reviewStyles.itemTop}>
        <View style={[reviewStyles.avatar, { backgroundColor: C.tint }]}>
          <Text style={[reviewStyles.avatarText, { color: C.primaryForeground }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[reviewStyles.name, { color: C.foreground }]}>{review.reviewer_name}</Text>
            {isOwn && (
              <Pressable onPress={onDelete} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={C.destructive} />
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Stars rating={review.rating} size={12} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.mutedForeground }}>{date}</Text>
          </View>
        </View>
      </View>
      {!!review.comment && (
        <Text style={[reviewStyles.comment, { color: C.textSecondary }]}>{review.comment}</Text>
      )}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  item: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  itemTop: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  comment: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, marginTop: 4 },
});

// â”€â”€ Lawyer profile + reviews bottom sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LawyerProfileModal({ lawyer, visible, onClose, C, isDark, insets }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reviewData, setReviewData] = useState(null);    // { reviews, averageRating, count, breakdown }
  const [myReview, setMyReview]     = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Write-review form
  const [writeOpen, setWriteOpen]   = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Contact form
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg]   = useState('');
  const [sending, setSending]         = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!lawyer) return;
    try {
      setLoadingReviews(true);
      const [rd, mr] = await Promise.all([
        reviewsApi.getForLawyer(lawyer.id),
        user ? reviewsApi.getMyReview(lawyer.id) : Promise.resolve({ review: null }),
      ]);
      setReviewData(rd);
      setMyReview(mr.review);
      if (mr.review) {
        setDraftRating(mr.review.rating);
        setDraftComment(mr.review.comment || '');
      } else {
        setDraftRating(0);
        setDraftComment('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReviews(false);
    }
  }, [lawyer, user]);

  useEffect(() => {
    if (visible) fetchReviews();
    else { setWriteOpen(false); setContactOpen(false); }
  }, [visible, fetchReviews]);

  async function handleSubmitReview() {
    if (!draftRating) { Alert.alert('', 'Please select a star rating.'); return; }
    try {
      setSubmitting(true);
      await reviewsApi.create({ lawyerId: lawyer.id, rating: draftRating, comment: draftComment.trim() || undefined });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWriteOpen(false);
      await fetchReviews();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteReview() {
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await reviewsApi.delete(myReview.id);
            setMyReview(null);
            setDraftRating(0);
            setDraftComment('');
            await fetchReviews();
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to delete review.');
          }
        },
      },
    ]);
  }

  async function handleSendContact() {
    if (!contactMsg.trim()) { Alert.alert('Error', 'Please write a message.'); return; }
    try {
      setSending(true);
      await contactsApi.create(lawyer.id, contactMsg);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Request Sent', 'Your contact request has been submitted.');
      setContactOpen(false);
      setContactMsg('');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send contact request.');
    } finally {
      setSending(false);
    }
  }

  async function handleStartChat() {
    try {
      if (user?.id && user.id === lawyer.id) {
        throw new Error('You cannot start a chat with yourself.');
      }

      setStartingChat(true);
      const payload = await messageService.startConversation({ participantId: lawyer.id });
      const conversationId = payload?.conversation?.id || payload?.conversation?.conversation_id || payload?.conversationId;
      if (!conversationId) {
        throw new Error('Could not open chat');
      }

      router.push({
        pathname: '/(messaging)/chat',
        params: {
          conversationId,
          title: lawyer.name,
        },
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to open chat.');
    } finally {
      setStartingChat(false);
    }
  }

  if (!lawyer) return null;

  const photoUri = lawyer.profilePhotoUrl ? `${BASE_URL}${lawyer.profilePhotoUrl}` : null;
  const initials = lawyer.name.replace('MaÃ®tre ', '').split(' ').map(n => n[0]).join('').slice(0, 2);
  const avg = reviewData?.averageRating ?? lawyer.rating ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={profileStyles.overlay}>
        <Pressable style={profileStyles.backdrop} onPress={onClose} />
        <View style={[profileStyles.sheet, { backgroundColor: C.background, paddingBottom: insets.bottom + 20 }]}>
          {/* Handle */}
          <View style={[profileStyles.handle, { backgroundColor: C.border }]} />

          {/* Close */}
          <Pressable style={[profileStyles.closeBtn, { backgroundColor: C.muted }]} onPress={onClose}>
            <Ionicons name="close" size={18} color={C.foreground} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* â”€â”€ Lawyer header â”€â”€ */}
            <View style={profileStyles.header}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={profileStyles.avatar} />
              ) : (
                <View style={[profileStyles.avatar, { backgroundColor: C.tint }]}>
                  <Text style={[profileStyles.avatarText, { color: C.primaryForeground }]}>{initials}</Text>
                </View>
              )}
              <Text style={[profileStyles.name, { color: C.foreground }]}>{lawyer.name}</Text>
              <Text style={[profileStyles.spec, { color: C.accent }]}>{lawyer.specialization} {t.lawSuffix}</Text>
              <View style={profileStyles.availRow}>
                <View style={[profileStyles.availDot, { backgroundColor: lawyer.isAvailable ? C.success : C.mutedForeground }]} />
                <Text style={[profileStyles.availText, { color: lawyer.isAvailable ? C.success : C.mutedForeground }]}>
                  {lawyer.isAvailable ? t.availableForCases : t.currentlyUnavailable}
                </Text>
              </View>

              {/* Rating summary */}
              <View style={profileStyles.ratingSummary}>
                <Text style={[profileStyles.ratingBig, { color: C.foreground }]}>{parseFloat(avg).toFixed(1)}</Text>
                <View style={{ alignItems: 'flex-start', gap: 4 }}>
                  <Stars rating={avg} size={16} color={C.accent} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.mutedForeground }}>
                    {reviewData?.count ?? lawyer.casesHandled ?? 0} {reviewData?.count === 1 ? t.reviewLabel : t.reviewsLabel}
                  </Text>
                </View>
              </View>
            </View>

            {/* â”€â”€ Stats row â”€â”€ */}
            <View style={[profileStyles.statsRow, { backgroundColor: C.card }]}>
              {[
                { icon: 'briefcase-outline', label: t.casesStatLabel, value: lawyer.casesHandled ?? 0 },
                { icon: 'time-outline', label: t.experienceLabel, value: `${lawyer.experience ?? 0} ${t.yrsLabel}` },
                { icon: 'cash-outline', label: t.feeLabel, value: lawyer.consultationFee ? `${lawyer.consultationFee} TND` : t.freeLabel },
              ].map((s, i) => (
                <View key={i} style={[profileStyles.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: C.border }]}>
                  <Ionicons name={s.icon} size={18} color={C.accent} />
                  <Text style={[profileStyles.statVal, { color: C.foreground }]}>{s.value}</Text>
                  <Text style={[profileStyles.statLbl, { color: C.textSecondary }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* â”€â”€ Bio â”€â”€ */}
            {!!lawyer.bio && (
              <View style={profileStyles.section}>
                <Text style={[profileStyles.sectionTitle, { color: C.textSecondary }]}>{t.aboutSection}</Text>
                <Text style={[profileStyles.bio, { color: C.foreground }]}>{lawyer.bio}</Text>
              </View>
            )}

            {/* â”€â”€ Action buttons â”€â”€ */}
            {user?.role === 'user' && (
              <Pressable
                style={({ pressed }) => [
                  profileStyles.messageBtn,
                  { backgroundColor: C.tint },
                  pressed && { opacity: 0.85 },
                  startingChat && { opacity: 0.7 },
                ]}
                onPress={handleStartChat}
                disabled={startingChat}
              >
                {startingChat ? (
                  <ActivityIndicator size="small" color={C.primaryForeground} />
                ) : (
                  <Feather name="message-circle" size={16} color={C.primaryForeground} />
                )}
                <Text style={[profileStyles.messageBtnText, { color: C.primaryForeground }]}>
                  Message Lawyer
                </Text>
              </Pressable>
            )}
            <View style={profileStyles.actions}>
              <Pressable
                style={({ pressed }) => [profileStyles.actionBtn, { backgroundColor: C.tint }, pressed && { opacity: 0.85 }]}
                onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setContactOpen(true); }}
              >
                <Feather name="message-circle" size={16} color={C.primaryForeground} />
                <Text style={[profileStyles.actionBtnText, { color: C.primaryForeground }]}>{t.requestContact}</Text>
              </Pressable>
              {user?.role === 'user' && (
                <Pressable
                  style={({ pressed }) => [profileStyles.actionBtnOutline, { borderColor: C.accent }, pressed && { opacity: 0.85 }]}
                  onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWriteOpen(v => !v); }}
                >
                  <Ionicons name="star-outline" size={16} color={C.accent} />
                  <Text style={[profileStyles.actionBtnOutlineText, { color: C.accent }]}>
                    {myReview ? t.editMyReview : t.writeReview}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* â”€â”€ Write/edit review form â”€â”€ */}
            {writeOpen && user?.role === 'user' && (
              <View style={[profileStyles.reviewForm, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[profileStyles.sectionTitle, { color: C.textSecondary }]}>
                  {myReview ? t.updateYourReview : t.yourReviewTitle}
                </Text>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <StarPicker value={draftRating} onChange={setDraftRating} size={36} C={C} />
                  <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 6, fontFamily: 'Inter_400Regular' }}>
                    {(t.ratingLabels || [])[draftRating] || t.tapToRate}
                  </Text>
                </View>
                <TextInput
                  style={[profileStyles.commentInput, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
                  placeholder={t.shareExperience}
                  placeholderTextColor={C.mutedForeground}
                  value={draftComment}
                  onChangeText={setDraftComment}
                  multiline
                  numberOfLines={3}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    style={[profileStyles.submitBtn, { backgroundColor: C.accent }, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmitReview}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={profileStyles.submitBtnText}>{myReview ? t.updateBtn : t.submitLabel}</Text>}
                  </Pressable>
                  {myReview && (
                    <Pressable
                      style={[profileStyles.deleteBtn, { borderColor: C.destructive }]}
                      onPress={handleDeleteReview}
                    >
                      <Ionicons name="trash-outline" size={14} color={C.destructive} />
                      <Text style={[profileStyles.deleteBtnText, { color: C.destructive }]}>{t.deleteLabel}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* â”€â”€ Reviews â”€â”€ */}
            <View style={profileStyles.section}>
              <Text style={[profileStyles.sectionTitle, { color: C.textSecondary }]}>
                {t.reviewsSection} {reviewData ? `(${reviewData.count})` : ''}
              </Text>
              {reviewData && reviewData.count > 0 && (
                <RatingBreakdown breakdown={reviewData.breakdown} total={reviewData.count} C={C} />
              )}
              <View style={{ marginTop: 14 }}>
                {loadingReviews ? (
                  <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />
                ) : !reviewData?.reviews?.length ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                    <Ionicons name="chatbubble-outline" size={32} color={C.mutedForeground} />
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.mutedForeground }}>{t.noReviewsYet}</Text>
                  </View>
                ) : (
                  reviewData.reviews.map(r => (
                    <ReviewItem
                      key={r.id}
                      review={r}
                      isOwn={r.user_id === user?.id}
                      onDelete={handleDeleteReview}
                      C={C}
                    />
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          {/* â”€â”€ Contact request sub-modal â”€â”€ */}
          <Modal visible={contactOpen} animationType="fade" transparent onRequestClose={() => setContactOpen(false)}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={profileStyles.contactOverlay}>
                <View style={[profileStyles.contactSheet, { backgroundColor: C.card }]}>
                  <View style={profileStyles.contactHeader}>
                    <Text style={[profileStyles.contactTitle, { color: C.foreground }]}>{t.contactTitle} {lawyer.name}</Text>
                    <Pressable onPress={() => setContactOpen(false)}>
                      <Ionicons name="close" size={22} color={C.foreground} />
                    </Pressable>
                  </View>
                  <Text style={[profileStyles.contactLabel, { color: C.textSecondary }]}>{t.yourMessage}</Text>
                  <TextInput
                    style={[profileStyles.contactInput, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
                    placeholder={t.describeMatter}
                    placeholderTextColor={C.mutedForeground}
                    value={contactMsg}
                    onChangeText={setContactMsg}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      style={[profileStyles.submitBtn, { backgroundColor: C.tint, flex: 1 }, sending && { opacity: 0.7 }]}
                      onPress={handleSendContact}
                      disabled={sending}
                    >
                      {sending
                        ? <ActivityIndicator size="small" color={C.primaryForeground} />
                        : <><Feather name="send" size={14} color={C.primaryForeground} /><Text style={[profileStyles.submitBtnText, { color: C.primaryForeground }]}>{t.sendRequest}</Text></>}
                    </Pressable>
                    <Pressable
                      style={[profileStyles.deleteBtn, { borderColor: C.border, paddingHorizontal: 16 }]}
                      onPress={() => { setContactOpen(false); setContactMsg(''); }}
                    >
                      <Text style={[profileStyles.deleteBtnText, { color: C.foreground }]}>{t.cancel}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

const profileStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  closeBtn: { position: 'absolute', top: 16, right: 20, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  header: { alignItems: 'center', paddingVertical: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  spec: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 4 },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: 'rgba(212,160,60,0.06)' },
  ratingBig: { fontSize: 40, fontFamily: 'Inter_700Bold', lineHeight: 44 },
  statsRow: { flexDirection: 'row', borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statVal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginBottom: 10 },
  messageBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  actionBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  actionBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
  actionBtnOutlineText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewForm: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  commentInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  submitBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  deleteBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  contactOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  contactSheet: { borderRadius: 20, padding: 24 },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  contactTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  contactLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  contactInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
});

// â”€â”€ Lawyer card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LawyerCard({ lawyer, onPress, C, t }) {
  const initials = lawyer.name.replace('MaÃ®tre ', '').split(' ').map(n => n[0]).join('').slice(0, 2);
  const photoUri = lawyer.profilePhotoUrl ? `${BASE_URL}${lawyer.profilePhotoUrl}` : null;
  return (
    <Pressable
      style={({ pressed }) => [styles.lawyerCard, { backgroundColor: C.card }, pressed && { opacity: 0.92 }]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(lawyer);
      }}
    >
      <View style={styles.lawyerTop}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.lawyerAvatar} />
        ) : (
          <View style={[styles.lawyerAvatar, { backgroundColor: C.tint }]}>
            <Text style={[styles.lawyerInitials, { color: C.primaryForeground }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.lawyerName, { color: C.foreground }]}>{lawyer.name}</Text>
            <Text style={[styles.lawyerSpec, { color: C.accent }]}>{lawyer.specialization} {t.lawSuffix}</Text>
            <View style={styles.availRow}>
              <View style={[styles.availDot, { backgroundColor: lawyer.isAvailable ? C.success : C.mutedForeground }]} />
              <Text style={[styles.availText, { color: lawyer.isAvailable ? C.success : C.mutedForeground }]}>
                {lawyer.isAvailable ? t.available : t.unavailable}
              </Text>
            </View>
          </View>
        <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
      </View>
      {!!lawyer.bio && (
        <Text style={[styles.lawyerBio, { color: C.textSecondary }]} numberOfLines={2}>{lawyer.bio}</Text>
      )}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Stars rating={lawyer.rating} size={13} color={C.accent} />
          <Text style={[styles.statValue, { color: C.textSecondary }]}>{parseFloat(lawyer.rating || 0).toFixed(1)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="briefcase-outline" size={13} color={C.textSecondary} />
          <Text style={[styles.statValue, { color: C.textSecondary }]}>{lawyer.casesHandled} {t.casesLabel}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={13} color={C.textSecondary} />
          <Text style={[styles.statValue, { color: C.textSecondary }]}>{lawyer.experience} {t.yrsLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// â”€â”€ Main screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function LawyersPage() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { isDark } = useThemeContext();
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLawyer, setSelectedLawyer] = useState(null);

  const fetchLawyers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'All') params.specialization = filter;
      const data = await lawyersApi.getAll(params);
      setLawyers(data.lawyers);
    } catch (e) {
      Alert.alert('Error', 'Failed to load lawyers');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchLawyers(); }, [fetchLawyers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return lawyers;
    const q = search.toLowerCase();
    return lawyers.filter(l =>
      l.name.toLowerCase().includes(q) || l.specialization.toLowerCase().includes(q)
    );
  }, [lawyers, search]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.headerSection, { paddingTop: insets.top + 12, backgroundColor: C.headerBg, borderBottomColor: C.border }]}>
          <Text style={[styles.pageTitle, { color: C.tint }]}>{t.lawyers}</Text>
          <View style={[styles.searchBar, { backgroundColor: C.background }]}>
            <Feather name="search" size={18} color={C.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: C.foreground }]}
              placeholder={t.searchLawyers}
              placeholderTextColor={C.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {SPECIALIZATIONS.map(s => (
              <Pressable
                key={s}
                style={[styles.filterPill, { backgroundColor: C.background, borderColor: C.border }, filter === s && { backgroundColor: C.tint, borderColor: C.tint }]}
                onPress={() => setFilter(s)}
              >
                <Text style={[styles.filterText, { color: C.textSecondary }, filter === s && { color: C.primaryForeground }]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          renderItem={({ item }) => <LawyerCard lawyer={item} onPress={setSelectedLawyer} C={C} t={t} />}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} /> : null}
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={40} color={C.mutedForeground} />
              <Text style={[styles.emptyText, { color: C.mutedForeground }]}>{t.noLawyersFound}</Text>
            </View>
          ) : null}
        />

        <LawyerProfileModal
          lawyer={selectedLawyer}
          visible={!!selectedLawyer}
          onClose={() => setSelectedLawyer(null)}
          C={C}
          isDark={isDark}
          insets={insets}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  pageTitle: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filtersRow: { gap: 8, paddingBottom: 4 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  lawyerCard: { borderRadius: 16, padding: 18, marginBottom: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  lawyerTop: { flexDirection: 'row', gap: 14, marginBottom: 10, alignItems: 'center' },
  lawyerAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  lawyerInitials: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  lawyerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  lawyerSpec: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  lawyerBio: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
});
