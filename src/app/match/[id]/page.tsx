"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateUserId } from "@/lib/user-id";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: string;
};

type SignalPayload = {
  type: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from: string;
};

const ROUND_SECONDS = 30;
const TOTAL_SECONDS = ROUND_SECONDS * 2;

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [timer, setTimer] = useState(TOTAL_SECONDS);
  const [status, setStatus] = useState("Setting up camera...");
  const [round, setRound] = useState(1);
  const [currentSpeaker, setCurrentSpeaker] = useState<"you" | "opponent">(
    "you"
  );

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const matchRef = useRef<MatchRow | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const battleEndedRef = useRef(false);

  const userId = useMemo(() => {
    const fromQuery = searchParams.get("u");
    if (fromQuery) {
      return fromQuery;
    }

    if (typeof window === "undefined") {
      return "";
    }
    return getOrCreateUserId();
  }, [searchParams]);

  const applyTurnMute = useCallback(
    (speakerUserId: string) => {
      const localStream = localStreamRef.current;
      if (!localStream) {
        return;
      }

      const isMyTurn = userId === speakerUserId;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMyTurn;
      });
    },
    [userId]
  );

  const teardownConnection = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingIceCandidatesRef.current = [];

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) {
      return;
    }

    const pending = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Ignore invalid or stale ICE candidates from old peer states.
      }
    }
  }, []);

  const endBattle = useCallback(() => {
    if (battleEndedRef.current) {
      return;
    }
    battleEndedRef.current = true;
    teardownConnection();

    const match = matchRef.current;
    if (!match || !userId || !params.id) {
      const winnerFallback = Math.random() > 0.5 ? "you" : "opponent";
      router.replace(`/match/${params.id}/result?winner=${winnerFallback}`);
      return;
    }

    const winnerUserId = Math.random() > 0.5 ? userId : match.user_a === userId ? match.user_b : match.user_a;
    const winnerPerspective = winnerUserId === userId ? "you" : "opponent";

    void (async () => {
      try {
        const response = await fetch(`/api/matches/${params.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerUserId }),
        });

        const data = (await response.json()) as {
          winnerUserId?: string;
          loserUserId?: string;
          winnerEloBefore?: number;
          winnerEloAfter?: number;
          loserEloBefore?: number;
          loserEloAfter?: number;
          winnerRank?: string;
          loserRank?: string;
        };

        if (!response.ok) {
          router.replace(`/match/${params.id}/result?winner=${winnerPerspective}`);
          return;
        }

        const yourEloBefore =
          data.winnerUserId === userId
            ? data.winnerEloBefore
            : data.loserEloBefore;
        const yourEloAfter =
          data.winnerUserId === userId
            ? data.winnerEloAfter
            : data.loserEloAfter;
        const opponentEloBefore =
          data.winnerUserId === userId
            ? data.loserEloBefore
            : data.winnerEloBefore;
        const opponentEloAfter =
          data.winnerUserId === userId
            ? data.loserEloAfter
            : data.winnerEloAfter;
        const yourRank =
          data.winnerUserId === userId ? data.winnerRank : data.loserRank;
        const opponentRank =
          data.winnerUserId === userId ? data.loserRank : data.winnerRank;

        const query = new URLSearchParams({
          winner: winnerPerspective,
          winnerId: data.winnerUserId ?? "",
          loserId: data.loserUserId ?? "",
          winnerEloBefore: String(data.winnerEloBefore ?? ""),
          winnerEloAfter: String(data.winnerEloAfter ?? ""),
          loserEloBefore: String(data.loserEloBefore ?? ""),
          loserEloAfter: String(data.loserEloAfter ?? ""),
          yourEloBefore: String(yourEloBefore ?? ""),
          yourEloAfter: String(yourEloAfter ?? ""),
          opponentEloBefore: String(opponentEloBefore ?? ""),
          opponentEloAfter: String(opponentEloAfter ?? ""),
          yourRank: yourRank ?? "",
          opponentRank: opponentRank ?? "",
        });

        router.replace(`/match/${params.id}/result?${query.toString()}`);
      } catch {
        router.replace(`/match/${params.id}/result?winner=${winnerPerspective}`);
      }
    })();
  }, [params.id, router, teardownConnection, userId]);

  useEffect(() => {
    if (!userId || !params.id) {
      return;
    }

    let mounted = true;

    async function setup() {
      try {
        const matchRes = await fetch(`/api/matches/${params.id}`);
        const matchData = (await matchRes.json()) as {
          match?: MatchRow;
          error?: string;
        };

        if (!matchRes.ok || !matchData.match) {
          throw new Error(matchData.error ?? "Match not found");
        }

        const match = matchData.match;
        matchRef.current = match;
        if (match.user_a !== userId && match.user_b !== userId) {
          throw new Error("You are not part of this match");
        }

        const isInitiator = match.user_a === userId;

        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerRef.current = peer;

        localStream.getTracks().forEach((track) => {
          peer.addTrack(track, localStream);
        });

        peer.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };

        const channel = supabase.channel(`match-signal-${params.id}`);
        channelRef.current = channel;

        channel.on("broadcast", { event: "signal" }, async (event) => {
          const payload = event.payload as SignalPayload;
          if (!mounted || payload.from === userId || !peerRef.current) {
            return;
          }

          if (payload.type === "offer" && payload.sdp) {
            await peerRef.current.setRemoteDescription(payload.sdp);
            await flushPendingIceCandidates();
            const answer = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(answer);
            await channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                type: "answer",
                sdp: answer,
                from: userId,
              } satisfies SignalPayload,
            });
          }

          if (payload.type === "answer" && payload.sdp) {
            await peerRef.current.setRemoteDescription(payload.sdp);
            await flushPendingIceCandidates();
            setStatus("Opponent connected. Battle on!");
          }

          if (payload.type === "ice" && payload.candidate) {
            if (peerRef.current.remoteDescription) {
              try {
                await peerRef.current.addIceCandidate(payload.candidate);
              } catch {
                // Ignore invalid or stale ICE candidates from old peer states.
              }
            } else {
              pendingIceCandidatesRef.current.push(payload.candidate);
            }
          }
        });

        peer.onicecandidate = (iceEvent) => {
          if (!iceEvent.candidate) {
            return;
          }

          void channel.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "ice",
              candidate: iceEvent.candidate.toJSON(),
              from: userId,
            } satisfies SignalPayload,
          });
        };

        await channel.subscribe(async (channelStatus) => {
          if (channelStatus === "SUBSCRIBED" && isInitiator && peerRef.current) {
            const offer = await peerRef.current.createOffer();
            await peerRef.current.setLocalDescription(offer);
            await channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                type: "offer",
                sdp: offer,
                from: userId,
              } satisfies SignalPayload,
            });
            setStatus("Waiting for opponent connection...");
          }
        });

        setStatus("Round 1: User A roasts, User B is muted");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to start match";
        setStatus(message);
      }
    }

    void setup();

    return () => {
      mounted = false;
      teardownConnection();
    };
  }, [flushPendingIceCandidates, params.id, teardownConnection, userId]);

  useEffect(() => {
    const match = matchRef.current;
    if (!match || !userId) {
      return;
    }

    const roundOneSpeaker = match.user_a;
    const roundTwoSpeaker = match.user_b;
    const inRoundOne = timer > ROUND_SECONDS;
    const speakerUserId = inRoundOne ? roundOneSpeaker : roundTwoSpeaker;

    setRound(inRoundOne ? 1 : 2);
    setCurrentSpeaker(speakerUserId === userId ? "you" : "opponent");
    applyTurnMute(speakerUserId);

    if (inRoundOne) {
      setStatus("Round 1: User A roasts, User B is muted");
    } else {
      setStatus("Round 2: User B roasts, User A is muted");
    }
  }, [applyTurnMute, timer, userId]);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          window.clearInterval(countdown);
          endBattle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(countdown);
    };
  }, [endBattle]);

  return (
    <main className="arena-bg min-h-screen px-2 py-4 text-zinc-100 md:px-4">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-3 flex items-center justify-center">
          <div className="arena-badge">
            <span className="arena-dot" />
            Match {params.id}
          </div>
        </div>

        <div className="mb-3 text-center">
          <p className="font-mono text-3xl font-black tracking-[0.18em] md:text-4xl">
            {String(Math.floor(timer / 60)).padStart(2, "0")}:
            {String(timer % 60).padStart(2, "0")}
          </p>
          <p className="mt-2 text-sm uppercase tracking-[0.22em] text-zinc-300">
            Round {round} • {currentSpeaker === "you" ? "Your turn" : "Opponent turn"}
          </p>
          <p className="arena-subtle mt-1 text-xs uppercase tracking-[0.18em]">
            {status}
          </p>
        </div>

        <div className="relative grid gap-3 md:grid-cols-2 md:gap-4">
          <section className="arena-card relative overflow-hidden rounded-3xl p-2 md:p-3">
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-zinc-200 backdrop-blur">
              Your cam
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-[42vh] min-h-[300px] w-full rounded-2xl border border-white/10 bg-black object-cover md:h-[68vh]"
            />
          </section>
          <section className="arena-card relative overflow-hidden rounded-3xl p-2 md:p-3">
            <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg border border-white/20 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-zinc-200 backdrop-blur">
              Opponent cam
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-[42vh] min-h-[300px] w-full rounded-2xl border border-white/10 bg-black object-cover md:h-[68vh]"
            />
          </section>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/60 bg-black/70 px-3 py-2 text-xs font-black tracking-[0.2em] text-orange-100 shadow-[0_0_24px_rgba(255,126,40,0.55)]">
            VS
          </div>
        </div>

        <div className="mx-auto mt-4 w-full max-w-4xl">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-200 transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, ((TOTAL_SECONDS - timer) / TOTAL_SECONDS) * 100)
                )}%`,
              }}
            />
          </div>
          <p className="arena-subtle mt-2 text-center text-[10px] uppercase tracking-[0.24em]">
            Roast meter
          </p>
        </div>
      </div>
    </main>
  );
}
