import React, { Component, Fragment } from 'react';
import TweetItemList from 'components/tweets/TweetItemList';
import * as tweetActions from 'store/modules/tweets';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Loading from 'components/common/Loading';
import throttle from 'lodash/throttle';
import { compose } from 'redux';
import { withRouter } from 'react-router-dom';

const getScrollTop = () => {
  if (!document.body) return 0;
  const scrollTop = document.documentElement
    ? document.documentElement.scrollTop
    : document.body.scrollTop;
  return scrollTop;
};

const getScrollBottom = () => {
  if (!document.body) return 0;
  const { scrollHeight } = document.body;
  const { innerHeight } = window;
  const scrollTop = getScrollTop();
  return scrollHeight - innerHeight - scrollTop;
};

class TweetItemListContainer extends Component {
  lastCursor = null; // 가장 최근 추가로딩한 아이디; 중복 로딩을 방지합니다.
  timeoutId = null; // recentUpdate 의 timeoutId

  recentUpdater = () => {
    // 30초마다 새 데이터를 받아옵니다.
    // 실제 프로덕션에서는 이렇게 주기적으로 받아오는 것 보다
    // websocket 을 사용하거나
    // https://pusher.com/ 같은 서비스를 사용하는게 성능에 좋습니다.
    // timeoutId 를 설정한 이유는 componentWillUnmount 에서
    // 작업 취소를 하기 위함입니다.
    this.timeoutid = setTimeout(() => {
      const {
        TweetActions,
        match: { params },
      } = this.props;
      const { tag, username } = params;
      TweetActions.getRecent({
        cursor: this.props.firstId,
        recent: true,
        tag,
        username,
      });
      this.recentUpdater();
    }, 30 * 1000);
  };

  initialize = async () => {
    // 현재 선택된 태그, 유저명에 따라 초기 요청을 넣어줍니다.
    // didMount 와 didUpdate 에서 호출됩니다.
    const {
      TweetActions,
      match: { params },
    } = this.props;
    const { tag, username } = params;
    try {
      await TweetActions.getInitial({
        username,
        tag,
      });
      this.recentUpdater(); // 30초 후 새 트윗 로딩
    } catch (e) {}
  };

  componentDidMount() {
    this.initialize();
    window.addEventListener('scroll', this.handleScroll);
  }

  componentDidUpdate(prevProps, prevState) {
    // 특정 조건이 바뀌었는지 검사를 합니다
    if (
      this.props.match.params.username !== prevProps.match.params.username ||
      this.props.match.params.tag !== prevProps.match.params.tag
    ) {
      // 그래서 유저명이나 태그 바뀌면 재요청
      // 리액트 라우터에서 주소에 따라 다른걸 불러와야하면 이렇게
      // cdu 에서 작업 하시면 됩니다.
      this.initialize();
    }
  }

  componentWillUnmount() {
    // 언마운트시 스크롤 이벤트 제거
    window.addEventListener('scroll', this.handleScroll);
    // 30초뒤 해야 하는 작업 중지
    clearTimeout(this.timeoutId);
  }

  getNext = () => {
    const { TweetActions, lastId, loadingNext, end } = this.props;
    if (loadingNext || end || this.lastCursor === lastId) return;
    TweetActions.getNext({ cursor: lastId });
    this.lastCursor = lastId;
  };

  handleScroll = throttle(() => {
    const scrollBottom = getScrollBottom();
    if (scrollBottom < 350) {
      this.getNext();
    }
  }, 250);

  handleOpenRemoveModal = ({ id, needPass }) => {
    const { TweetActions } = this.props;
    TweetActions.openRemoveModal({ id, needPass });
  };

  render() {
    const { list, loadingRecent, loadingNext, username } = this.props;

    if (!list) {
      return <Loading />;
    }

    return (
      <Fragment>
        <TweetItemList
          tweets={list}
          onRemove={this.handleOpenRemoveModal}
          currentUser={username}
        />
        {loadingNext && <Loading />}
      </Fragment>
    );
  }
}

export default compose(
  withRouter,
  connect(
    ({ tweets, pender, user }) => ({
      list: tweets.list,
      firstId: tweets.list && tweets.list[0] && tweets.list[0]._id,
      lastId:
        tweets.list &&
        tweets.list[tweets.list.length - 1] &&
        tweets.list[tweets.list.length - 1]._id,
      loadingNext: pender.pending['tweets/GET_NEXT'],
      end: tweets.end,
      username: user.user && user.user.username,
    }),
    dispatch => ({
      TweetActions: bindActionCreators(tweetActions, dispatch),
    })
  )
)(TweetItemListContainer);